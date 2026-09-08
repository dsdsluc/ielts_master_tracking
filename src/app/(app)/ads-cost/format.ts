export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatVnd(value: string | number) {
  return `${new Intl.NumberFormat("vi-VN").format(Number(value))} đ`;
}
