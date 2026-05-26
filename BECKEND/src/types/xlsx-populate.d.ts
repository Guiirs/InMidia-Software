declare module 'xlsx-populate' {
  interface Workbook {
    sheet(index: number | string): Sheet;
    outputAsync(): Promise<Buffer>;
  }

  interface Sheet {
    cell(address: string): Cell;
  }

  interface Cell {
    value(): any;
    value(val: any): Cell;
  }

  namespace XlsxPopulate {
    function fromFileAsync(path: string): Promise<Workbook>;
    function fromDataAsync(data: Buffer | ArrayBuffer): Promise<Workbook>;
  }

  export = XlsxPopulate;
}
