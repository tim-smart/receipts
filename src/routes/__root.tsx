import { createRootRoute, Outlet } from "@tanstack/react-router"

export const Route = createRootRoute({
  component: () => (
    <div className="mx-auto min-h-screen max-w-6xl px-5 sm:px-8">
      <Outlet />
    </div>
  ),
})
