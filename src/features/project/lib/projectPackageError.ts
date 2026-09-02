export class ProjectPackageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectPackageError';
  }
}
