// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "./drawer"

afterEach(cleanup)

// jsdom has no matchMedia, which vaul reads while open
window.matchMedia ??= (media: string) =>
  ({
    matches: false,
    media,
    addEventListener() {},
    removeEventListener() {},
  }) as unknown as MediaQueryList

function Fields() {
  return (
    <>
      <DrawerTitle>Export</DrawerTitle>
      <DrawerDescription>Export receipts</DrawerDescription>
      <input aria-label="Currency" />
      <button>Export</button>
    </>
  )
}

function TriggeredDrawer() {
  return (
    <>
      <Drawer>
        <DrawerTrigger>Open</DrawerTrigger>
        <DrawerContent>
          <Fields />
        </DrawerContent>
      </Drawer>
      <button>After</button>
    </>
  )
}

// drawers opened from a menu or another control have no DrawerTrigger
function ControlledDrawer() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <Fields />
        </DrawerContent>
      </Drawer>
      <button>After</button>
    </>
  )
}

const expectFocusInDialog = () =>
  expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true)

describe.each([
  ["with a trigger", TriggeredDrawer],
  ["without a trigger", ControlledDrawer],
])("Drawer %s", (_, Component) => {
  it("keeps keyboard focus inside while open and restores it on close", async () => {
    const user = userEvent.setup()
    render(<Component />)
    const opener = screen.getByRole("button", { name: "Open" })

    opener.focus()
    await user.keyboard("{Enter}")
    await waitFor(expectFocusInDialog)

    for (let i = 0; i < 4; i++) {
      await user.tab()
      expectFocusInDialog()
    }
    for (let i = 0; i < 4; i++) {
      await user.tab({ shift: true })
      expectFocusInDialog()
    }

    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(document.activeElement).toBe(opener)
  })
})
