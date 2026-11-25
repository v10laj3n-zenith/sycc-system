export type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

export function ok<T>(data?: T): ActionResult<T> {
  return data === undefined ? { success: true } : { success: true, data };
}

export function fail<T = never>(error: string): ActionResult<T> {
  return { success: false, error };
}
