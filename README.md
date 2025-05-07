# ⚙️ Swagger Auto Generate — API-классы и типы из OpenAPI

> 🇷🇺 Автоматическая генерация API-классов и типов по Swagger JSON  
> 🇬🇧 Automatically generate API classes and types from Swagger JSON

---

## 📂 Структура проекта / Project Structure

```
your-project/
├── src/
│   └── api/
│       ├── api-generated/     ← 📁 сюда попадут сгенерированные файлы
│       │   └── some/
│       │       ├── Some.api.ts
│       │       ├── Some.types.ts
│       │       └── index.ts
│       └── swagger/           ← 📁 положите сюда свои Swagger JSON файлы
├── swagger-auto-generate/     ← 🧠 этот репозиторий
│   ├── generate-api.ts
│   └── templates/
├── package.json               ← 🎯 здесь будут скрипты для генерации
```

---

## 🇷🇺 Руководство по использованию

### 1. 📥 Склонируйте репозиторий в корень проекта:

```bash
git clone https://github.com/kmastyugin/swagger-auto-generate
```

### 2. 📦 Установите зависимости:

```bash
pnpm install
```

### 3. 🗂 Создайте директорию:

```bash
mkdir -p src/api/api-generated
```

### 4. 📄 Поместите свои Swagger (`.json`) файлы в:

```bash
src/api/swagger/
```

### 5. 🔧 Добавьте скрипт генерации в ваш `package.json`:

```json
"scripts": {
  "api:generate": "cd swagger-auto-generate && pnpm install && pnpm exec ts-node generate-api.ts"
}
```

### 6. 🧹 Хотите автопроверку ESLint?

```json
"scripts": {
  "api:generate": "cd swagger-auto-generate && pnpm install && pnpm exec ts-node generate-api.ts && eslint ../src/api/api-generated --ext .ts,.js --fix"
}
```

---

## 🧪 Пример сгенерированных файлов / Example of Generated Files

### 📁 `src/api/api-generated/some/Some.api.ts`

```ts
import type { HttpClient, HttpRequestConfig } from "@/api/api.types";
import type {
  CreateUserRequestBody,
  CreateUserResponse,
  GetUsersResponse,
} from "./Some.types";

export class SomeApi {
  constructor(private readonly httpClient: HttpClient) {}

  async getUsers(config?: HttpRequestConfig): Promise<GetUsersResponse> {
    return this.httpClient.get("/users", config);
  }

  async createUser(
    params: { body: CreateUserRequestBody },
    config?: HttpRequestConfig
  ): Promise<CreateUserResponse> {
    return this.httpClient.post("/users", params.body, config);
  }
}
```

---

### 📁 `src/api/api-generated/some/Some.types.ts`

```ts
export interface CreateUserRequestBody {
  name: string;
  email: string;
}

export interface CreateUserResponse {
  id: string;
  name: string;
  email: string;
}

export type GetUsersResponse = CreateUserResponse[];
```

---

## 🇬🇧 Usage Guide

### 1. 📥 Clone this repo into the root of your project:

```bash
git clone https://github.com/kmastyugin/swagger-auto-generate
```

### 2. 📦 Install required dev dependencies:

```bash
pnpm install
```

### 3. 🗂 Create output folder:

```bash
mkdir -p src/api/api-generated
```

### 4. 📄 Put your Swagger `.json` files into:

```bash
src/api/swagger/
```

### 5. 🔧 Add this script to your main `package.json`:

```json
"scripts": {
  "api:generate": "cd swagger-auto-generate && pnpm install && pnpm exec ts-node generate-api.ts"
}
```

### 6. 🧹 Optional: run ESLint on generated files:

```json
"scripts": {
  "api:generate": "cd swagger-auto-generate && pnpm install && pnpm exec ts-node generate-api.ts && eslint ../src/api/api-generated --ext .ts,.js --fix"
}
```

---

## 🧪 Пример команды запуска / Example command

```bash
pnpm run api:generate
```

---

## 🧪 Пример сгенерированных файлов / Example of Generated Files

### 📁 `src/api/api-generated/some/Some.api.ts`

```ts
import type { HttpClient, HttpRequestConfig } from "@/api/api.types";
import type {
  CreateUserRequestBody,
  CreateUserResponse,
  GetUsersResponse,
} from "./Some.types";

export class SomeApi {
  constructor(private readonly httpClient: HttpClient) {}

  async getUsers(config?: HttpRequestConfig): Promise<GetUsersResponse> {
    return this.httpClient.get("/users", config);
  }

  async createUser(
    params: { body: CreateUserRequestBody },
    config?: HttpRequestConfig
  ): Promise<CreateUserResponse> {
    return this.httpClient.post("/users", params.body, config);
  }
}
```

---

### 📁 `src/api/api-generated/some/Some.types.ts`

```ts
export interface CreateUserRequestBody {
  name: string;
  email: string;
}

export interface CreateUserResponse {
  id: string;
  name: string;
  email: string;
}

export type GetUsersResponse = CreateUserResponse[];
```

---

## 🤝 Pull requests and contributions are welcome!
