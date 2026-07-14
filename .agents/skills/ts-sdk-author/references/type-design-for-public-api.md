# SDK 公共 API 的类型设计

为已发布 SDK 设计类型与应用代码的类型设计不是同一回事。应用的类型由编写它们的团队消费；SDK 的类型由陌生人在第一次遇到自动生成的 `.d.ts` 时阅读。由此产生三个约束：

1. **不要泄露内部实现。** 每个导出的符号都成为 API——辅助联合类型、"便利"别名、重新导出都算在内。
2. **保持可演进性。** 每个导出的类型都是一份合约。泛型参数需要默认值，选项对象需要可选字段，可辨识联合类型（discriminated union）需要一个逃生阀。
3. **保持可推断性。** 用户不应为 80% 的调用手动标注泛型。如果 `client.users.get('123')` 需要写成 `client.users.get<User>('123')`，设计就失败了。

---

## 1. 用于领域建模的品牌类型（Branded Types）

动机：防止调用者在你需要 `UserId` 的地方传入原始 `string`，或者交换 `UserId` 和 `OrderId`。否则编译器会将它们视为相同的基本类型。

```typescript
// Phantom（仅编译时）品牌。零运行时成本。
type Brand<T, B extends string> = T & { readonly __brand: B };

export type UserId  = Brand<string, "UserId">;
export type OrderId = Brand<number, "OrderId">;
export type Email   = Brand<string, "Email">;
export type Url     = Brand<string, "Url">;

// 智能构造函数在边界处验证，然后在内部转型。
export function toUserId(id: string): UserId {
  if (!/^usr_[a-z0-9]{12}$/.test(id)) throw new TypeError("Invalid UserId");
  return id as UserId;
}
export function toEmail(s: string): Email {
  if (!s.includes("@")) throw new TypeError("Invalid Email");
  return s as Email;
}

// 类型守卫变体——不抛出异常地收窄类型。
export function isUserId(v: string): v is UserId {
  return /^usr_[a-z0-9]{12}$/.test(v);
}

declare function getOrder(userId: UserId, orderId: OrderId): Promise<unknown>;
// getOrder("abc" as string, 1 as number) — 类型错误：两者都不是品牌类型。
```

**Phantom vs 运行时标签。** `__brand` 字段仅存在于 phantom——运行时不存在，零字节，可干净地序列化为 JSON。运行时标签（`{ value: string; kind: "UserId" }`）捕获更多 bug，但会破坏 JSON 互操作并强制解包。SDK 应优先使用 phantom 品牌，并在反序列化边界处验证。

**Symbol 品牌** 更严格（两个库不会意外冲突）：

```typescript
declare const userIdBrand: unique symbol;
export type UserId = string & { readonly [userIdBrand]: void };
```

**反模式：** 公开导出 `Brand<T,B>` 辅助类型。它成为 API 的一部分，任何变更都是破坏性的。将 `Brand` 保留为内部实现；仅导出具体的品牌别名。

---

## 2. 泛型 API 对外接口

泛型是 SDK 类型在你还不知道的用户 schema 宇宙中保持有用的方式。目标：**最大化推断，最小化标注。**

### 带 schema 参数的泛型客户端

```typescript
export interface SchemaShape {
  readonly [resource: string]: { readonly [op: string]: unknown };
}

export function createClient<Schema extends SchemaShape>(baseUrl: string) {
  return {
    call<R extends keyof Schema, O extends keyof Schema[R]>(
      resource: R,
      op: O,
      input: Schema[R][O],
    ): Promise<unknown> {
      return fetch(`${baseUrl}/${String(resource)}/${String(op)}`, {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.json());
    },
  };
}

type MySchema = {
  users:  { get: { id: string }; create: { name: string } };
  orders: { list: { userId: string } };
};
const client = createClient<MySchema>("https://api.example.com");
client.call("users", "get",    { id: "u1" });    // OK
client.call("users", "get",    { name: "bad" }); // 类型错误
client.call("users", "delete", { id: "u1" });    // 类型错误
```

### 泛型默认值防止破坏性变更

```typescript
// V1
export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };

// V2 破坏性变更——需要新增参数。
export type ApiResponse<T, E> = { ok: true; data: T } | { ok: false; error: E };

// V2 非破坏性变更——新增参数有默认值。
export type ApiResponse<T, E = string> =
  | { ok: true; data: T }
  | { ok: false; error: E };
```

**规则：** 1.0 之后添加的每个泛型都需要默认值。添加必需的泛型是主版本（major-version）破坏性变更。

### 泛型约束

```typescript
export interface Entity { readonly id: string }

export interface Repository<T extends Entity> {
  find(id: T["id"]): Promise<T | null>;
  findAll(): Promise<readonly T[]>;
  create(data: Omit<T, "id">): Promise<T>;
  update(id: T["id"], data: Partial<Omit<T, "id">>): Promise<T>;
  delete(id: T["id"]): Promise<void>;
}

export function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```

### 推断权衡

| 模式 | 可推断？ |
|---|---|
| `fn<T>(x: T)` | 是 — 从参数推断 |
| `fn<T>(): T` | 否 — 用户必须标注 |
| `fn<T>(x: { value: T })` | 是 — 在参数内部 |
| `fn<T extends string>(x: T)` | 是 — 保留字面量 |
| `class C<T> {}` | 否 — 必须在 `new C<T>()` 时设置 |

当你想要零标注使用体验时，将泛型放在调用点，而不是构造点：

```typescript
// 糟糕——每次调用都需要标注。
export class Store<T> { get(key: string): T { /* ... */ return null as never } }
new Store<User>().get("k");

// 良好——泛型在方法上，从运行时载体推断。
export class TypedStore {
  get<T>(key: string, schema: Schema<T>): T { /* ... */ return null as never }
}
typedStore.get("k", UserSchema); // 推断出类型
```

---

## 3. 条件类型与映射类型

这些类型从单一事实来源——一个 schema、一个路由表、一个函数签名——推导出面向用户的类型。

### 条件类型与 `infer`

```typescript
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
type R1 = UnwrapPromise<Promise<User>>; // User

// 分布式——按联合成员逐个应用。
type ToArray<T> = T extends unknown ? T[] : never;
type X = ToArray<string | number>; // string[] | number[]

// 非分布式——包裹在元组中以固定为单个联合。
type ToArrayMono<T> = [T] extends [unknown] ? T[] : never;
type Y = ToArrayMono<string | number>; // (string | number)[]

// 递归展平。
type Flatten<T> =
  T extends Array<infer U>
    ? U extends Array<unknown> ? Flatten<U> : U
    : T;
type F = Flatten<string[][][]>; // string
```

### 映射类型与键重映射

```typescript
export type Frozen<T> = { readonly [K in keyof T]: T[K] };

type Getters<T> = { [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K] };
type UG = Getters<{ name: string; age: number }>;
// { getName: () => string; getAge: () => number }

export type PickByType<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K];
};
```

### 用于 URL 解析的模板字面量类型

```typescript
export type ExtractRouteParams<S extends string> =
  S extends `${string}/:${infer Param}/${infer Rest}`
    ? { [K in Param]: string } & ExtractRouteParams<`/${Rest}`>
    : S extends `${string}/:${infer Param}`
      ? { [K in Param]: string }
      : {};

type P = ExtractRouteParams<"/users/:id/posts/:postId">;
// { id: string; postId: string }

export function get<Path extends string>(
  path: Path,
  params: ExtractRouteParams<Path>,
): Promise<unknown> {
  let url = path as string;
  for (const [k, v] of Object.entries(params)) url = url.replace(`:${k}`, v as string);
  return fetch(url).then((r) => r.json());
}

get("/users/:id", { id: "u1" });   // OK
get("/users/:id", { wrong: "x" }); // 类型错误
```

### 完整类型安全的 REST 客户端

```typescript
type ApiEndpoints = {
  "/users": {
    GET:  { response: User[] };
    POST: { body: CreateUserDto; response: User };
  };
  "/users/:id": {
    GET:    { params: { id: string }; response: User };
    PUT:    { params: { id: string }; body: UpdateUserDto; response: User };
    DELETE: { params: { id: string }; response: void };
  };
};

type Options<S> =
  & (S extends { body:   infer B } ? { body:   B } : unknown)
  & (S extends { params: infer P } ? { params: P } : unknown)
  & (S extends { query:  infer Q } ? { query:  Q } : unknown);

export class ApiClient {
  request<P extends keyof ApiEndpoints, M extends keyof ApiEndpoints[P]>(
    method: M, path: P, options: Options<ApiEndpoints[P][M]>,
  ): Promise<ApiEndpoints[P][M] extends { response: infer R } ? R : never> {
    return null as never;
  }
}
const c = new ApiClient();
await c.request("GET",  "/users", {});                                   // User[]
await c.request("GET",  "/users/:id", { params: { id: "1" } });          // User
await c.request("POST", "/users", { body: { name: "n", email: "e" } });  // User
```

---

## 4. 类型守卫与可辨识联合类型（Discriminated Unions）

公共类型守卫定义了用户如何在你提供的数据上进行分支。要有意地设计它们。

### Result 类型——SDK 的通用返回形状

```typescript
export type Result<T, E = SdkError> =
  | { readonly ok: true;  readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok  = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// 用户用一个分支干净地收窄类型：
const r = await sdk.users.get(id);
if (r.ok) r.value.email; else r.error.code;
```

SDK 从不为*预期中的*失败抛出异常——它返回 `Result`。仅对程序员错误（错误参数、不变式违反）抛出异常。

### 穷尽性辅助函数

```typescript
export function assertNever(x: never): never {
  throw new Error(`Unhandled: ${JSON.stringify(x)}`);
}

type Event =
  | { kind: "open" }
  | { kind: "message"; data: string }
  | { kind: "close"; reason: string };

function handle(e: Event) {
  switch (e.kind) {
    case "open":    return;
    case "message": return e.data;
    case "close":   return e.reason;
    default:        return assertNever(e); // 在编译时捕获新增变体
  }
}
```

公开发布 `assertNever`——当用户在你提供的联合类型上进行分支时，他们会需要它。

### 类型谓词与断言函数

```typescript
// 谓词——通过返回类型收窄。
export function isError<T>(r: Result<T>): r is { ok: false; error: SdkError } {
  return r.ok === false;
}
export function isNonEmpty<T>(arr: readonly T[]): arr is readonly [T, ...T[]] {
  return arr.length > 0;
}

// 断言形式——通过 `asserts` 收窄，否则抛出异常。
export function assertIsDefined<T>(v: T): asserts v is NonNullable<T> {
  if (v === null || v === undefined) throw new Error("Expected value");
}
export function assertIsEmail(s: string): asserts s is Email {
  if (!s.includes("@")) throw new TypeError("Not an email");
}
```

**陷阱：** 断言函数需要*显式*的 `asserts` 返回类型标注；TS 不会推断它。忘记它会被静默地破坏收窄功能。

---

## 5. 用于配置的 Builder 模式

SDK 通常暴露一个配置 builder：`createClient().withRetry(3).withTimeout(5000).build()`。使用 `this` 类型以实现流畅式调用。

```typescript
interface RequestOptions {
  url: string;
  method: "GET" | "POST";
  body?: unknown;
  timeoutMs?: number;
}

export class RequestBuilder {
  private data: Partial<RequestOptions> = {};
  url(u: string):    this { this.data.url = u; return this }
  method(m: RequestOptions["method"]): this { this.data.method = m; return this }
  body(b: unknown):  this { this.data.body = b; return this }
  timeout(ms: number): this { this.data.timeoutMs = ms; return this }
  build(): RequestOptions {
    if (!this.data.url || !this.data.method) throw new Error("url and method required");
    return this.data as RequestOptions;
  }
}
```

### 编译时必需字段（高级）

```typescript
type Builder<T, Set extends keyof T = never> = {
  [P in Exclude<keyof T, Set> as `set${Capitalize<string & P>}`]:
    (v: T[P]) => Builder<T, Set | P>;
} & {
  build: [Exclude<keyof T, Set>] extends [never] ? () => T : never;
};
```

权衡：类型重，工具提示（tooltip）丑陋。对于大多数 SDK，在 `Partial<Config>` 上进行运行时检查更友好。将类型跟踪的 builder 保留给真正关键的配置（例如，安全密钥）。

### 预定义配置文件通常优于 builder

```typescript
export const presets = {
  fast:   { timeoutMs: 1_000,  retries: 0 },
  robust: { timeoutMs: 30_000, retries: 5 },
} as const;

export function createClient(opts: {
  apiKey: string;
  preset?: keyof typeof presets;
  overrides?: Partial<typeof presets["robust"]>;
}) { /* ... */ }
```

使用适合的最简单工具。

---

## 6. 工具类型：哪些要发布，哪些保留为内部实现

内建类型（`Partial`、`Pick`、`Omit`、`Awaited`、`ReturnType`、`Parameters`、`NonNullable`）在 lib 中——在代码内部自由使用它们。问题是哪些*自定义*类型要重新导出。

| 工具类型 | 内建 | 发布？ | 原因 |
|---|---|---|---|
| `Partial<T>`、`Pick`、`Omit`、`Awaited` | 是 | 不适用 | 已在 lib 中 |
| `DeepPartial<T>` | 否 | 也许 | 对配置 diff 有用 |
| `DeepReadonly<T>` | 否 | 也许 | 如果你返回冻结对象 |
| `Prettify<T>` | 否 | 不要 | 工具提示美观性；仅内部使用 |
| `RequireAtLeastOne<T>` | 否 | 是 | 表达"至少一个"选项 |
| `RequireExactlyOne<T>` | 否 | 是 | 表达"恰好一个" / XOR 选项 |
| `Mutable<T>` | 否 | 罕见 | 大多是内部使用 |
| `Brand<T, B>` | 否 | 不要 | 保留为内部；导出具体品牌 |
| `ValueOf<T>` | 否 | 是 | 对类似枚举的 const 有用 |
| `Nullable<T>` | 否 | 是 | 足够常见，值得标准化一种形式 |

```typescript
export type DeepReadonly<T> = T extends (...a: never[]) => unknown
  ? T
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

export type RequireAtLeastOne<T, K extends keyof T = keyof T> =
  Omit<T, K> &
  { [P in K]-?: Required<Pick<T, P>> & Partial<Pick<T, Exclude<K, P>>> }[K];

export type RequireExactlyOne<T, K extends keyof T = keyof T> =
  Omit<T, K> &
  { [P in K]-?: Required<Pick<T, P>> & Partial<Record<Exclude<K, P>, never>> }[K];

export type ValueOf<T> = T[keyof T];
export type Nullable<T> = T | null | undefined;

// 仅内部使用——永远不要导出。
type Prettify<T> = { [K in keyof T]: T[K] } & {};
```

反模式：重新导出 `Prettify`。这是一个对 TS 编译器版本敏感的装饰性操作；用户会依赖交叉类型展平行为。

---

## 7. 用于库的 tsconfig

库的 tsconfig 与应用 tsconfig 不同。目标：**产出干净、可移植、快速消费的 `.d.ts`。**

### 核心库 tsconfig.json

```jsonc
{
  "compilerOptions": {
    // 目标——你支持的最低版本。ES2020 是安全的。
    "target": "ES2020",
    "lib": ["ES2020"],

    // 模块——匹配你的 package.json "type" 和消费者环境。
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,

    // 严格性——对库代码不可协商。
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,

    // 产出——库始终产出声明文件。
    "declaration": true,
    "declarationMap": true,         // 跳转到你的源码定义
    "sourceMap": true,
    "removeComments": false,         // 在 .d.ts 中保留 JSDoc
    "stripInternal": true,           // 从 .d.ts 中省略 /** @internal */
    "outDir": "./dist",
    "rootDir": "./src",

    // 隔离——快速工具（esbuild、swc）所必需。
    "isolatedModules": true,
    "verbatimModuleSyntax": true,    // TS 5.0+：显式类型/值导入
    "isolatedDeclarations": true,    // TS 5.5+：导出上的显式标注

    "incremental": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["**/*.test.ts", "**/*.spec.ts"]
}
```

### 库的标志参考

| 标志 | 用途 |
|---|---|
| `declaration: true` | 产出 `.d.ts`——强制 |
| `declarationMap: true` | 将 `.d.ts` 源码映射回源文件 |
| `sourceMap: true` | 从 node_modules 调试到你的源码 |
| `composite: true` | 项目引用；隐含 `declaration` + `incremental` |
| `incremental: true` | 在构建之间缓存类型信息 |
| `stripInternal: true` | 从产出的 `.d.ts` 中省略 `/** @internal */` 符号 |
| `isolatedModules: true` | 捕获代码打包器无法逐文件转译的内容 |
| `verbatimModuleSyntax: true` | TS 5.0+：强制 `import type` 规范 |
| `isolatedDeclarations: true` | TS 5.5+：每个导出必须有显式类型 |
| `skipLibCheck: true` | 跳过检查其他库的 `.d.ts`——更快 |
| `exactOptionalPropertyTypes: true` | `foo?: T` 从值中排除 `undefined` |
| `noUncheckedIndexedAccess: true` | `arr[0]` 变为 `T \| undefined`——更安全的对外接口 |

### `verbatimModuleSyntax`（TS 5.0+）

强制显式区分类型导入和值导入。结合 `isolatedModules`，混合导入在现代打包器和纯 ESM 环境下会出错。

```typescript
// 在 verbatimModuleSyntax 下错误
import { User, getUser } from "./users";

// 正确
import type { User } from "./users";
import { getUser } from "./users";
// 或组合形式
import { type User, getUser } from "./users";

// 重新导出也必须区分。
export type { User } from "./users";
export { getUser } from "./users";
```

如果你意外地以值方式导入类型，TS 会产出一个对不存在导出项的运行时引用。该标志强制执行正确性。

### `isolatedDeclarations`（TS 5.5+）

要求每个导出的符号都带有显式类型标注。`.d.ts` 生成变得确定性和可并行化，可通过 `swc` 和 `oxc` 等工具实现。库构建速度显著加快。

```typescript
// 被拒绝——返回类型被推断。
export function getUser(id: string) { return db.users.find(id); }

// 被接受——显式标注。
export function getUser(id: string): Promise<User | null> { return db.users.find(id); }

// 类字段也是如此。
export class Client {
  baseUrl = "https://api.example.com";              // 糟糕
  baseUrl: string = "https://api.example.com";      // 良好
}
```

权衡：更多的类型标注。收益：并行 `.d.ts` 产出；签名变得自文档化。**对于发布到 npm 的库，设置 `isolatedDeclarations: true`。**

### 用于 monorepo 的项目引用

```jsonc
// repo/tsconfig.json — solution 风格的根配置。
{ "files": [], "references": [
  { "path": "./packages/core" },
  { "path": "./packages/transport" },
  { "path": "./packages/sdk" }
] }

// repo/packages/sdk/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "composite": true, "outDir": "./dist", "rootDir": "./src" },
  "references": [{ "path": "../core" }, { "path": "../transport" }],
  "include": ["src/**/*"]
}
```

使用 `tsc --build` 构建。每个包独立产出 `.d.ts`；增量构建跳过未变更的图。

---

## 8. API 演进模式

### 弃用标记

```typescript
/**
 * @deprecated 使用 {@link createClient}。将在 v3 中移除。
 */
export function makeClient(opts: ClientOptions): Client { return null as never }

export interface ClientOptions {
  apiKey: string;
  /** @deprecated 自 v2.4 起被忽略 */
  legacy?: boolean;
}
```

`@deprecated` 被 TS 语言服务读取——编辑器会渲染删除线。

### 版本化子路径

```jsonc
// package.json
{
  "name": "@example/sdk",
  "exports": {
    ".":   { "types": "./dist/index.d.ts",    "default": "./dist/index.js" },
    "./v1":{ "types": "./dist/v1/index.d.ts", "default": "./dist/v1/index.js" },
    "./v2":{ "types": "./dist/v2/index.d.ts", "default": "./dist/v2/index.js" }
  }
}
```

用户选择加入：`import { Client } from "@example/sdk/v2"`。允许并行迁移。

### 开放的可辨识联合类型

封闭的联合类型在扩展时会破坏消费者的穷尽性 switch。

```typescript
// V1 — 封闭；V2 添加 "error" → 所有 switch 都中断。
export type Event = { kind: "open" } | { kind: "close" };

// 缓解措施：
// (a) 文档说明该联合类型是开放的；要求提供 `default` 分支。
// (b) 从一开始就包含一个逃生阀变体：
export type Event2 =
  | { kind: "open" }
  | { kind: "close" }
  | { kind: string; [key: string]: unknown };
```

权衡：在开放情况下失去穷尽性。文档化该策略。

### 公共类型的 Interface vs Type Alias

```typescript
// Interface — 用户可通过模块增强（module augmentation）进行扩展。
export interface ClientOptions { apiKey: string; }

// 用户侧插件：
declare module "@example/sdk" {
  interface ClientOptions { pluginOption?: string; }
}

// Type alias — 无法被增强。
export type ClientOptionsT = { apiKey: string };
```

**经验法则：**
- `interface` 用于插件可能增强的对象形状（传输选项、请求上下文、错误元数据）。
- `type` 用于联合类型、条件类型、元组、映射类型——任何不是简单对象形状的东西。
- `interface` 对于大型对象类型的性能也更好（TS 更积极地缓存它们）。

---

## 9. 反模式

### 泄露内部类型

```typescript
// 糟糕——内部辅助类型意外导出。
export type _InternalMapHelper<K, V> = Map<K, V> & { __magic: true };

// 良好——保持未导出并使用 stripInternal。
type InternalMapHelper<K, V> = Map<K, V> & { __magic: true };
export class Cache<K, V> {
  /** @internal */ store!: InternalMapHelper<K, V>;
}
```

### 过度泛型的辅助函数推断为 `unknown`

如果泛型辅助函数的返回类型在用户代码中显示为 `unknown`，帮助就消失了。要么收紧约束，要么放弃泛型。

```typescript
// 糟糕
export function pipe<T>(...fns: ((x: any) => any)[]): (x: T) => unknown { /* ... */ return null as never }

// 良好——递归元组类型保留链的末端。
type LastReturn<F extends readonly unknown[]> =
  F extends readonly [...unknown[], (...a: never) => infer R] ? R : never;
export function pipe<T, F extends readonly ((x: never) => unknown)[]>(
  ...fns: F
): (x: T) => LastReturn<F> { return null as never }
```

### 公共签名中的 `any`

```typescript
// 糟糕——`any` 污染下游所有内容。
export function call(method: string, args: any): any { return null as never }

// 良好——`unknown` 强制用户收窄类型。
export function call(method: string, args: unknown): unknown { return null as never }

// 更好——带默认值的泛型。
export function call<T = unknown>(method: string, args: Record<string, unknown>): Promise<T> { return null as never }
```

### 返回类型依赖于 `--strict`

```typescript
// 糟糕——推断的返回类型在 strict 下收窄，否则放宽。
export function findUser(id: string) { return db.find(id); }

// 良好——始终显式标注。
export function findUser(id: string): User | undefined { return db.find(id); }
```

用户可能设置了 `strict: false`。你的公共类型不应根据他们的 tsconfig 而改变形状。

### 在本应使用 interface 的地方导出 type alias

```typescript
// 糟糕——用户无法增强。
export type Hooks = {
  beforeRequest?: (req: Req) => void;
  afterResponse?: (res: Res) => void;
};

// 良好——插件可以增强。
export interface Hooks {
  beforeRequest?: (req: Req) => void;
  afterResponse?: (res: Res) => void;
}
```

### SDK 入口使用 default export 导出类

```typescript
// 糟糕——与命名导出、barrel、verbatimModuleSyntax 组合不佳。
export default class Sdk {}

// 良好——命名导出组合和树摇（tree-shake）效果更好。
export class Sdk {}
export type { SdkOptions, SdkResult };
export { createClient, presets };
```

### `enum`

```typescript
// 糟糕——运行时行为、打包器陷阱、反向映射。
export enum Status { Pending, Active, Closed }

// 良好——const 对象 + `as const` + ValueOf。
export const Status = { Pending: "pending", Active: "active", Closed: "closed" } as const;
export type Status = typeof Status[keyof typeof Status];
// "pending" | "active" | "closed"
```

`enum` 是 TS 中最令人遗憾的特性之一。在公共 SDK API 中避免使用。

---

## 10. 整合——最小 SDK 骨架

```typescript
// src/types.ts ---------------------------------------------------------------
type Brand<T, B extends string> = T & { readonly __brand: B };

export type UserId = Brand<string, "UserId">;
export type Email  = Brand<string, "Email">;

export function toUserId(s: string): UserId { return s as UserId }
export function toEmail(s: string): Email {
  if (!s.includes("@")) throw new TypeError("Bad email");
  return s as Email;
}

export interface User {
  readonly id: UserId;
  readonly email: Email;
  readonly createdAt: string;
}

export type Result<T, E = SdkError> =
  | { readonly ok: true;  readonly value: T }
  | { readonly ok: false; readonly error: E };

export interface SdkError {
  readonly code: "network" | "auth" | "not_found" | "validation" | "server";
  readonly message: string;
  readonly status?: number;
}

// src/client.ts --------------------------------------------------------------
export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export class Client {
  constructor(private readonly opts: ClientOptions) {}

  async getUser(id: UserId): Promise<Result<User>> {
    try {
      const res = await fetch(`${this.opts.baseUrl ?? "https://api"}/users/${id}`, {
        headers: { authorization: `Bearer ${this.opts.apiKey}` },
      });
      if (res.status === 404) return { ok: false, error: { code: "not_found", message: "no such user" } };
      if (!res.ok)             return { ok: false, error: { code: "server",    message: res.statusText, status: res.status } };
      return { ok: true, value: (await res.json()) as User };
    } catch (e) {
      return { ok: false, error: { code: "network", message: (e as Error).message } };
    }
  }
}

export function createClient(opts: ClientOptions): Client { return new Client(opts) }

// src/index.ts ---------------------------------------------------------------
export type { User, UserId, Email, Result, SdkError, ClientOptions };
export { Client, createClient, toUserId, toEmail };
```

```jsonc
// tsconfig.build.json
{
  "compilerOptions": {
    "target": "ES2020", "module": "NodeNext", "moduleResolution": "NodeNext",
    "strict": true, "noUncheckedIndexedAccess": true, "exactOptionalPropertyTypes": true,
    "isolatedModules": true, "verbatimModuleSyntax": true, "isolatedDeclarations": true,
    "declaration": true, "declarationMap": true, "sourceMap": true, "stripInternal": true,
    "outDir": "./dist", "rootDir": "./src", "skipLibCheck": true, "incremental": true
  },
  "include": ["src/**/*"],
  "exclude": ["**/*.test.ts"]
}
```

```jsonc
// package.json（摘录）
{
  "name": "@example/sdk",
  "version": "1.0.0",
  "type": "module",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": { "typescript": ">=5.5" }
}
```

这个骨架展示了什么：

- 品牌化的 `UserId`/`Email` 在 API 边界处强制执行领域完整性。
- `Result<T, E>` 可辨识联合类型——用户进行分支，对于预期中的失败从不 `try/catch`。
- `interface` 用于 `ClientOptions` 和 `User`——插件作者可增强。
- `type` 用于 `Result` 和 `SdkError`——联合类型，不适合增强。
- 仅命名导出，无默认导出。
- `isolatedDeclarations` 强制每个公共函数都有显式返回类型。
- `verbatimModuleSyntax` 保持导入诚实。
- 单一入口点，单一打包，确定性的 `.d.ts`。

两百行 TypeScript 和一个 tsconfig。大多数做到这些的已发布 SDK 就已经在开发者体验方面处于前四分之一了。