import base from '@mathgo/config/eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([globalIgnores(['android/**', 'ios/**', 'expo-env.d.ts']), base]);
