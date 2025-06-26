export const MODE: 'development' | 'production' = process.env.NODE_ENV as 'development' | 'production' || 'development';
export const PORT: number = 3000;
export const URL: string = `http://localhost:8080`;
export const ENABLE_CRON: boolean = false;
