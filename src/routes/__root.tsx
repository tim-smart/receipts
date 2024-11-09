import { createRootRoute, Outlet } from "@tanstack/react-router"

export const Route = createRootRoute({
  component: () => (
    <>
      <div
        className="max-w-4xl mx-auto px-5 min-h-screen"
        {...{ "vaul-drawer-wrapper": "" }}
      >
        <Outlet />
      </div>
    </>
  ),
})
