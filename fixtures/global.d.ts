// global.d.ts

declare global {
  namespace PlaywrightTest {
    interface Matchers<R> {
      /**
       * Validates the API response body against provided zod schema
       *
       * **Usage**
       *
       * ```js
       * expect(json).toMatchSchema(schema);
       * ```
       * @example
       * const schema = z.object({
       * name: z.string(),
       * age: z.number(),
       * });
       * await expect(json).toMatchSchema(schema);
       * @param schema zod schema object.
       */
      toMatchSchema(schema: object): Promise<{ message: () => string; pass: boolean }>
      /**
       *  Validates the API response body against provided AJV schema
       * @param schema  JSON schema object or Swagger/OpenAPI spec.
       * @param options  AJV options object.
       * @example
       * const schema = {
        * type: 'object',
        * properties: {
        * name: { type: 'string' },
        * age: { type: 'number' },
        }
        * required: ['name', 'age'],
        * };
        * await expect(json).toMatchSchemaAJV(schema);
       }
       */
      toMatchSchemaAJV(schema: object, options?: object): Promise<{ message: () => string; pass: boolean }>
    }
  }
}

export {}
