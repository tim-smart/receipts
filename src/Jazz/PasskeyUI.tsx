import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/input"
import { PasskeyAuthState } from "jazz-react/src/auth/PasskeyAuth"
import { useState } from "react"

export const PasskeyAuthUI = ({ state }: { state: PasskeyAuthState }) => {
  const [username, setUsername] = useState<string>("")

  if (state.state !== "ready") {
    return null
  }

  const { logIn, signUp } = state

  return (
    <div className="h-screen w-full flex justify-center items-center">
      <div className="max-w-sm flex flex-col gap-4">
        {state.errors.length > 0 && (
          <div style={{ color: "red" }}>
            {state.errors.map((error, index) => (
              <div key={index}>{error}</div>
            ))}
          </div>
        )}
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            signUp(username)
          }}
        >
          <Input
            placeholder="Display name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="webauthn"
          />
          <Button type="submit">Sign up</Button>
        </form>

        <Button onClick={logIn}>Log in with existing account</Button>
      </div>
    </div>
  )
}
