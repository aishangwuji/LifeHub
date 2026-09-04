// CSS Modules type declaration for TypeScript
declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}