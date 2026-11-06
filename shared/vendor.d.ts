declare module 'datascript' {
  const datascript: {
    empty_db: (schema?: Record<string, unknown>) => any
    db_with: (db: any, data: any[]) => any
    q: (query: string, ...inputs: any[]) => any[]
  }
  export default datascript
}
