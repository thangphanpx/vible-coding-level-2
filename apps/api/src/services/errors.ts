/** Lỗi nghiệp vụ: route đổi thành mã HTTP tương ứng. */
export type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 429;

export class ServiceError extends Error {
  status: ErrorStatus;
  fields?: Record<string, string>;
  constructor(status: ErrorStatus, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export const notFound = (what: string) => new ServiceError(404, `Không tìm thấy ${what}`);
/** Đã đăng nhập nhưng vai trò không được làm việc này. */
export const forbidden = (message = "Bạn không có quyền thực hiện thao tác này") => new ServiceError(403, message);
/** Chưa đăng nhập hoặc phiên hết hạn. */
export const unauthorized = (message = "Vui lòng đăng nhập") => new ServiceError(401, message);
