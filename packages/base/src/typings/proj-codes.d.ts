declare module 'proj-codes' {
  interface IProjCode {
    auth_name: string;
    code: string;
    name: string;
    proj4string: string;
  }

  const projCodes: Record<string, IProjCode>;

  export default projCodes;
}
