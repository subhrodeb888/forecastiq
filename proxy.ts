export { auth as proxy } from "@/auth";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/products/:path*",
    "/categories/:path*",
    "/suppliers/:path*",
    "/purchases/:path*",
    "/sales/:path*",
    "/reports/:path*",
    "/forecast/:path*",
    "/import/:path*",
    "/insights/:path*",
    "/settings/:path*",
  ],
};
