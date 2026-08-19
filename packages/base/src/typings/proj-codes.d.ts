declare module 'proj-codes' {
  export interface IProjCode {
    auth_name: string;
    code: string;
    name: string;
    proj4string: string;
  }

  const projCodes: Record<string, IProjCode>;

  export { projCodes };
  export default projCodes;
}
