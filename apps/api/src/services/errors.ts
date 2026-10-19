/** Lỗi nghiệp vụ: route đổi thành mã HTTP tương ứng. */
export class ServiceError extends Error {
  status: 400 | 404 | 409;
  fields?: Record<string, string>;
  constructor(status: 400 | 404 | 409, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export const notFound = (what: string) => new ServiceError(404, `Không tìm thấy ${what}`);
