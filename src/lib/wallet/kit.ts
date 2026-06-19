/**
 * Stellar wallet connection — lazy + browser-only.
 *
 * We instantiate the kit with **Stellar modules ONLY** (no WalletConnect / EVM)
 * and load everything through dynamic `import()` so nothing touches `window`
 * during SSR. Importing each module from its own subpath keeps the bundler from
 * pulling the WalletConnect connector (see SECURITY.md for the audit rationale).
 */
type StellarWalletsKitClass =
  typeof import('@creit.tech/stellar-wallets-kit/sdk')['StellarWalletsKit'];

let kitPromise: Promise<StellarWalletsKitClass> | null = null;

async function getKit(): Promise<StellarWalletsKitClass> {
  if (!kitPromise) {
    kitPromise = (async () => {
      const [{ StellarWalletsKit }, freighter, albedo, xbull, lobstr, rabet, hana] =
        await Promise.all([
          import('@creit.tech/stellar-wallets-kit/sdk'),
          import('@creit.tech/stellar-wallets-kit/modules/freighter'),
          import('@creit.tech/stellar-wallets-kit/modules/albedo'),
          import('@creit.tech/stellar-wallets-kit/modules/xbull'),
          import('@creit.tech/stellar-wallets-kit/modules/lobstr'),
          import('@creit.tech/stellar-wallets-kit/modules/rabet'),
          import('@creit.tech/stellar-wallets-kit/modules/hana'),
        ]);

      StellarWalletsKit.init({
        modules: [
          new freighter.FreighterModule(),
          new albedo.AlbedoModule(),
          new xbull.xBullModule(),
          new lobstr.LobstrModule(),
          new rabet.RabetModule(),
          new hana.HanaModule(),
        ],
      });

      return StellarWalletsKit;
    })();
  }
  return kitPromise;
}

/** Opens the wallet picker, connects, and returns the chosen address (G...). */
export async function connectWallet(): Promise<string> {
  const kit = await getKit();
  const { address } = await kit.authModal();
  return address;
}

/** Signs an unsigned challenge/transaction XDR with the connected wallet. */
export async function signXdr(
  xdr: string,
  address: string,
  networkPassphrase: string,
): Promise<string> {
  const kit = await getKit();
  const { signedTxXdr } = await kit.signTransaction(xdr, {
    address,
    networkPassphrase,
  });
  return signedTxXdr;
}

export async function disconnectWallet(): Promise<void> {
  const kit = await getKit();
  await kit.disconnect();
}
