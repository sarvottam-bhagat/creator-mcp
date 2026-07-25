export type StudioErrorCode =
  | 'unauthorized'
  | 'not_found'
  | 'invalid_input'
  | 'not_ready'
  | 'dependency_failed';

export class StudioError extends Error {
  constructor(
    public readonly code: StudioErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'StudioError';
  }
}
