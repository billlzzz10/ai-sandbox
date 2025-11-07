import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  collectCoverageFrom: ['**/*.ts', '!**/node_modules/**', '!tests/**', '!dist/**'],
  coverageDirectory: '<rootDir>/coverage',
  clearMocks: true,
  moduleFileExtensions: ['ts', 'js', 'json'],
};

export default config;
