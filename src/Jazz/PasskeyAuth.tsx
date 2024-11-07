import {
  RawAccountID,
  AgentSecret,
  cojsonInternals,
  CryptoProvider,
} from "cojson"
import { Account, AuthMethod, AuthResult, ID } from "jazz-tools"
import { useMemo, useState } from "react";

type LocalStorageData = {
  accountID: ID<Account>
  accountSecret: AgentSecret
}

const localStorageKey = "jazz-logged-in-secret"

export class BrowserPasskeyAuth implements AuthMethod {
  constructor(
    public driver: BrowserPasskeyAuth.Driver,
    public appName: string,
    // TODO: is this a safe default?
    public appHostname: string = window.location.hostname,
  ) {}

  accountLoaded() {
    this.driver.onSignedIn({ logOut })
  }

  onError(error: string | Error) {
    this.driver.onError(error)
  }

  async start(crypto: CryptoProvider): Promise<AuthResult> {
    if (localStorage[localStorageKey]) {
      const localStorageData = JSON.parse(
        localStorage[localStorageKey],
      ) as LocalStorageData

      const accountID = localStorageData.accountID as ID<Account>
      const secret = localStorageData.accountSecret

      return {
        type: "existing",
        credentials: { accountID, secret },
        onSuccess: () => {
          this.driver.onSignedIn({ logOut })
        },
        onError: (error: string | Error) => {
          this.driver.onError(error)
        },
        logOut: () => {
          delete localStorage[localStorageKey]
        },
      } satisfies AuthResult
    } else {
      return new Promise<AuthResult>((resolve) => {
        this.driver.onReady({
          signUp: async (username) => {
            const secretSeed = crypto.newRandomSecretSeed()

            resolve({
              type: "new",
              creationProps: { name: username },
              initialSecret: crypto.agentSecretFromSecretSeed(secretSeed),
              saveCredentials: async ({ accountID, secret }) => {
                const webAuthNCredentialPayload = new Uint8Array(
                  cojsonInternals.secretSeedLength +
                    cojsonInternals.shortHashLength,
                )

                webAuthNCredentialPayload.set(secretSeed)
                webAuthNCredentialPayload.set(
                  cojsonInternals.rawCoIDtoBytes(
                    accountID as unknown as RawAccountID,
                  ),
                  cojsonInternals.secretSeedLength,
                )

                await navigator.credentials.create({
                  publicKey: {
                    challenge: Uint8Array.from([0, 1, 2]),
                    rp: {
                      name: this.appName,
                      id: this.appHostname,
                    },
                    user: {
                      id: webAuthNCredentialPayload,
                      name: username + ` (${new Date().toLocaleString()})`,
                      displayName: username,
                    },
                    pubKeyCredParams: [{ alg: -7, type: "public-key" }],
                    authenticatorSelection: {
                      authenticatorAttachment: "platform",
                    },
                    timeout: 60000,
                    attestation: "direct",
                  },
                })

                localStorage[localStorageKey] = JSON.stringify({
                  accountID,
                  accountSecret: secret,
                } satisfies LocalStorageData)
              },
              onSuccess: () => {
                this.driver.onSignedIn({ logOut })
              },
              onError: (error: string | Error) => {
                this.driver.onError(error)
              },
              logOut: () => {
                delete localStorage[localStorageKey]
              },
            })
          },
          logIn: async () => {
            const webAuthNCredential = (await navigator.credentials.get({
              publicKey: {
                challenge: Uint8Array.from([0, 1, 2]),
                rpId: this.appHostname,
                allowCredentials: [],
                timeout: 60000,
              },
            })) as unknown as {
              response: { userHandle: ArrayBuffer }
            }
            if (!webAuthNCredential) {
              throw new Error("Couldn't log in")
            }

            const webAuthNCredentialPayload = new Uint8Array(
              webAuthNCredential.response.userHandle,
            )
            const accountSecretSeed = webAuthNCredentialPayload.slice(
              0,
              cojsonInternals.secretSeedLength,
            )

            const secret = crypto.agentSecretFromSecretSeed(accountSecretSeed)

            const accountID = cojsonInternals.rawCoIDfromBytes(
              webAuthNCredentialPayload.slice(
                cojsonInternals.secretSeedLength,
                cojsonInternals.secretSeedLength +
                  cojsonInternals.shortHashLength,
              ),
            ) as ID<Account>

            localStorage[localStorageKey] = JSON.stringify({
              accountID,
              accountSecret: secret,
            } satisfies LocalStorageData)

            resolve({
              type: "existing",
              credentials: { accountID, secret },
              onSuccess: () => {
                this.driver.onSignedIn({ logOut })
              },
              onError: (error: string | Error) => {
                this.driver.onError(error)
              },
              logOut: () => {
                delete localStorage[localStorageKey]
              },
            })
          },
        })
      })
    }
  }
}

/** @category Auth Providers */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace BrowserPasskeyAuth {
  export interface Driver {
    onReady: (next: {
      signUp: (username: string) => Promise<void>
      logIn: () => Promise<void>
    }) => void
    onSignedIn: (next: { logOut: () => void }) => void
    onError: (error: string | Error) => void
  }
}

function logOut() {
  delete localStorage[localStorageKey]
}

export type PasskeyAuthState = (
    | { state: "uninitialized" }
    | { state: "loading" }
    | {
          state: "ready";
          logIn: () => void;
          signUp: (username: string) => void;
      }
    | { state: "signedIn"; logOut: () => void }
) & {
    errors: string[];
};

/** @category Auth Providers */
export function usePasskeyAuth({
    appName,
    appHostname,
}: {
    appName: string;
    appHostname?: string;
}) {
    const [state, setState] = useState<PasskeyAuthState>({
        state: "loading",
        errors: [],
    });

    const authMethod = useMemo(() => {
        return new BrowserPasskeyAuth(
            {
                onReady(next) {
                    setState({
                        state: "ready",
                        logIn: next.logIn,
                        signUp: next.signUp,
                        errors: [],
                    });
                },
                onSignedIn(next) {
                    setState({
                        state: "signedIn",
                        logOut: () => {
                            next.logOut();
                            setState({ state: "loading", errors: [] });
                        },
                        errors: [],
                    });
                },
                onError(error) {
                    setState((state) => ({
                        ...state,
                        errors: [...state.errors, error.toString()],
                    }));
                },
            },
            appName,
            appHostname,
        );
    }, [appName, appHostname]);

    return [authMethod, state] as const;
}

export const PasskeyAuthBasicUI = ({ state }: { state: PasskeyAuthState }) => {
    const [username, setUsername] = useState<string>("");

    if (state.state === "signedIn") {
        return null;
    }

    if (state.state !== "ready") {
        return <div>Loading...</div>;
    }

    const { logIn, signUp } = state;

    return (
        <div
            style={{
                width: "100vw",
                height: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <div
                style={{
                    width: "18rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2rem",
                }}
            >
                {state.errors.length > 0 && (
                    <div style={{ color: "red" }}>
                        {state.errors.map((error, index) => (
                            <div key={index}>{error}</div>
                        ))}
                    </div>
                )}
                <form
                    style={{
                        width: "18rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                    }}
                    onSubmit={(e) => {
                        e.preventDefault();
                        signUp(username);
                    }}
                >
                    <input
                        placeholder="Display name"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete="webauthn"
                        style={{
                            border: "2px solid #000",
                            padding: "11px 8px",
                            borderRadius: "6px",
                        }}
                    />
                    <input
                        type="submit"
                        value="Sign up"
                        style={{
                            background: "#000",
                            color: "#fff",
                            padding: "13px 5px",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                        }}
                    />
                </form>
                <button
                    onClick={logIn}
                    style={{
                        background: "#000",
                        color: "#fff",
                        padding: "13px 5px",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                    }}
                >
                    Log in with existing account
                </button>
            </div>
        </div>
    );
};
