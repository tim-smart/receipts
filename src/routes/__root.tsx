import { createRootRoute, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/router-devtools"

export const Route = createRootRoute({
  component: () => (
    <>
      <div className="max-w-4xl mx-auto px-5">
        <Outlet />
      </div>
      <TanStackRouterDevtools />
    </>
  ),
})
