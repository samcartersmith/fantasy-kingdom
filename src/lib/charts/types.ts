export type ChartRow = {
  id: string;
  label: string;
  value: number;
  sublabel?: string;
};

export type ChartDimensions = {
  width: number;
  height: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
};

export type ValueFormatter = (n: number) => string;
