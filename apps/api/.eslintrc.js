/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ['@school-erp/config/eslint-nestjs'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
