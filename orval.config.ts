import { defineConfig } from "orval";

const input = process.env.ORVAL_INPUT ?? "./api/openapi.json";

export default defineConfig({
  api: {
    input,
    output: {
      target: "src/api/generated/client.ts",
      schemas: "src/api/generated/model",
      client: "react-query",
      mode: "single",
      clean: true,
      prettier: false,
      override: {
        mutator: {
          path: "./src/lib/http/client.ts",
          name: "customInstance"
        },
        query: {
          useQuery: true,
          useInfinite: false,
          useInfiniteQueryParam: "page"
        }
      }
    }
  }
});
