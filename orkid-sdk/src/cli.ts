#!/usr/bin/env node
/**
 * `orkid` — command-line interface for the Orkid swap API.
 *
 * Usage:
 *   orkid quote --from USDC --to WETH --amount 25 [--chain base]
 *   orkid solve --from USDC --to WETH --amount 25 --from-address 0x... --from-decimals 6 [--execute]
 *   orkid tokens [--chain base] [--search USDC] [--limit 20]
 *   orkid account
 *   orkid usage [--period 2026-09] [--event-type solve] [--limit 100]
 *   orkid rebates [--period 2026-09]
 *   orkid status
 *
 * Global flags:
 *   --api-key <40-hex>   Orkid API key (or set ORKID_API_KEY)
 *   --base-url <url>     API base URL (or set ORKID_API_URL, default https://orkidlabs.xyz)
 *   --json               Print raw JSON instead of a summary
 *   -h, --help           Show help
 */
import { OrkidClient } from './client'
import type { OrkidRouteRequest } from './types'

interface ParsedArgs {
  command: string | undefined
  positional: string[]
  flags: Record<string, string | boolean>
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = []
  const flags: Record<string, string | boolean> = {}
  let command: string | undefined

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '-h' || arg === '--help') {
      flags.help = true
    } else if (arg === '--json') {
      flags.json = true
    } else if (arg === '--execute') {
      flags.execute = true
    } else if (arg === '--dry-run') {
      flags.dryRun = true
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('-')) {
        flags[key] = next
        i++
      } else {
        flags[key] = true
      }
    } else if (!command) {
      command = arg
    } else {
      positional.push(arg)
    }
  }

  return { command, positional, flags }
}

function flag(flags: Record<string, string | boolean>, ...names: string[]): string | undefined {
  for (const n of names) {
    const v = flags[n]
    if (typeof v === 'string') return v
  }
  return undefined
}

function num(flags: Record<string, string | boolean>, ...names: string[]): number | undefined {
  const v = flag(flags, ...names)
  return v === undefined ? undefined : Number(v)
}

function die(message: string, code = 1): never {
  console.error(`error: ${message}`)
  process.exit(code)
}

function print(data: unknown, json: boolean, formatter?: (d: any) => void): void {
  if (json || !formatter) {
    console.log(JSON.stringify(data, null, 2))
    return
  }
  formatter(data)
}

const HELP = `orkid — Orkid swap API CLI

Commands:
  quote     Get an executable swap quote
              --from <sym> --to <sym> --amount <n> [--chain base]
              [--from-address 0x.. --from-decimals n --to-address 0x.. --to-decimals n]
  solve     Sign + submit a gasless swap (needs viem + ORKID_PRIVATE_KEY)
              same flags as quote, plus --user 0x.. --execute (default: dry-run)
  tokens    List tokens for a chain
              [--chain base] [--search <q>] [--limit n]
  account   Show the partner account for this API key
  usage     List usage events for this API key's account
              [--period YYYY-MM] [--event-type route|solve] [--limit n]
  rebates   List rebate ledger entries for this API key's account
              [--period YYYY-MM]
  confirm   Confirm a user-submitted swap tx (counts it toward volume/rebates)
              orkid confirm <txHash> [--chain base]
  status    API health check

Global flags:
  --api-key <40-hex>   Orkid API key (or ORKID_API_KEY env)
  --base-url <url>     API base URL (or ORKID_API_URL env, default https://orkidlabs.xyz)
  --test               Operator test mode (requires ORKID_OPERATOR_SECRET)
  --json               Raw JSON output
  -h, --help           This help

Environment:
  ORKID_API_KEY        Partner API key
  ORKID_API_URL        Override API base URL
  ORKID_PRIVATE_KEY    Wallet private key for 'solve' signing (hex, 0x-prefixed)
  ORKID_OPERATOR_SECRET  Operator test mode — marks usage as test (no rebate impact)
`

async function main(): Promise<void> {
  const { command, positional, flags } = parseArgs(process.argv.slice(2))

  if (!command || flags.help) {
    console.log(HELP)
    process.exit(command ? 0 : 1)
  }

  const apiKey = flag(flags, 'api-key', 'apiKey') || process.env.ORKID_API_KEY
  const baseUrl = flag(flags, 'base-url', 'baseUrl', 'url') || process.env.ORKID_API_URL
  const json = Boolean(flags.json)
  const testMode = Boolean(flags.test)

  const operatorSecret = process.env.ORKID_OPERATOR_SECRET
  if (testMode && !operatorSecret) {
    console.error('warning: --test without ORKID_OPERATOR_SECRET will record normal volume')
  }
  if (testMode && operatorSecret) {
    console.error('test mode: usage events marked is_test — excluded from rebates')
  }

  const client = new OrkidClient({ apiKey, baseUrl, operatorSecret: testMode ? operatorSecret : undefined })

  switch (command) {
    case 'quote': {
      const req = routeRequest(flags)
      const res = await client.getQuote(req)
      print(res, json, (r) => {
        if (!r.ok) return die(r.error || 'quote failed')
        const q = r.quote!
        console.log(`${req.amount} ${req.from} -> ${q.amountOut} ${req.to}  (${q.rate})`)
        console.log(`protocol:  ${q.protocol}`)
        console.log(`volume:    $${q.volumeUsd}`)
        if (r.savings) {
          console.log(`savings:   ${r.savings.savingsBps} bps vs MetaMask ($${r.savings.savingsUsd})`)
          console.log(`orkid fee: ${r.savings.orkidBps} bps`)
        }
        if (q.priceImpactBps !== undefined) console.log(`impact:    ${q.priceImpactBps} bps`)
        console.log(`compute:   ${r.computeMs}ms`)
      })
      if (!res.ok) process.exit(1)
      break
    }

    case 'solve': {
      const res = await cmdSolve(client, flags)
      print(res, json, (r) => {
        if (!r.ok) return die(r.error || 'solve failed')
        if (r.transaction?.txHash) console.log(`tx: ${r.transaction.txHash}`)
        else console.log(`calldata ready: to=${r.transaction?.to}`)
        if (r.savings) console.log(`savings: ${r.savings.savingsBps} bps ($${r.savings.savingsUsd})`)
      })
      if (!res.ok) process.exit(1)
      break
    }

    case 'tokens': {
      const res = await client.listTokens({
        chain: flag(flags, 'chain') || 'base',
        search: flag(flags, 'search'),
        limit: num(flags, 'limit'),
      })
      print(res, json, (r) => {
        if (!r.ok) return die(r.error || 'token lookup failed')
        for (const t of r.tokens || []) {
          console.log(`${t.symbol.padEnd(10)} ${t.address}  (${t.decimals} decimals, ${t.chain})`)
        }
        if (!r.tokens?.length) console.log('no tokens found')
      })
      if (!res.ok) process.exit(1)
      break
    }

    case 'account': {
      const res = await client.getAccount()
      print(res, json, (r) => {
        if (!r.ok || !r.account) return die(r.error || 'account lookup failed')
        const a = r.account
        console.log(`${a.name} (${a.slug})`)
        console.log(`id:           ${a.id}`)
        console.log(`rebate:       ${a.rebate_bps} bps ${a.rebate_active ? '(active)' : '(inactive)'}`)
        if (a.contact_email) console.log(`contact:      ${a.contact_email}`)
      })
      if (!res.ok) process.exit(1)
      break
    }

    case 'usage': {
      const res = await client.getUsage({
        period: flag(flags, 'period', 'month'),
        eventType: flag(flags, 'event-type', 'eventType', 'type'),
        limit: num(flags, 'limit'),
      })
      print(res, json, (r) => {
        if (r.error) return die(r.error)
        for (const e of r.events || []) {
          const vol = e.volume_usd != null ? `$${e.volume_usd}` : '-'
          const dry = e.is_dry_run ? ' [dry-run]' : ''
          console.log(`${e.created_at}  ${e.event_type.padEnd(6)} ${String(e.token_in || '-').padEnd(6)}->${String(e.token_out || '-').padEnd(6)} ${vol}${dry}`)
        }
        console.log(`---\ntotal volume: $${r.total_volume_usd ?? 0}   total savings: $${r.total_savings_usd ?? 0}`)
      })
      if (res.error) process.exit(1)
      break
    }

    case 'rebates': {
      const res = await client.getRebates({ period: flag(flags, 'period', 'month') })
      print(res, json, (r) => {
        if (r.error) return die(r.error)
        for (const b of r.rebates || []) {
          const month = String(b.period_start).slice(0, 7)
          console.log(`${month}  volume=$${b.volume_usd}  rate=${b.rebate_bps}bps  rebate=$${b.rebate_usd}  [${b.status}]`)
        }
        if (!r.rebates?.length) console.log('no rebates accrued yet')
      })
      if (res.error) process.exit(1)
      break
    }

    case 'confirm': {
      const txHash = flag(flags, 'tx-hash', 'txHash', 'tx') || positional[0]
      if (!txHash) die('confirm requires a tx hash: orkid confirm 0x...')
      const res = await client.confirmTransaction(txHash, flag(flags, 'chain'))
      print(res, json, (r) => {
        if (r.confirmed) {
          console.log(`confirmed — event ${r.eventId} now counts toward volume/rebates`)
        } else {
          die(r.error || 'not confirmed')
        }
      })
      if (!res.confirmed) process.exit(1)
      break
    }

    case 'status': {
      const res = await client.getStatus()
      print(res, json, (r) => console.log(r.ok === false ? 'API unreachable' : JSON.stringify(r)))
      break
    }

    default:
      console.error(`unknown command: ${command}\n`)
      console.log(HELP)
      process.exit(1)
  }
}

function routeRequest(flags: Record<string, string | boolean>): OrkidRouteRequest {
  const from = flag(flags, 'from')
  const to = flag(flags, 'to')
  const amount = flag(flags, 'amount')
  if (!from || !to || !amount) die('quote requires --from, --to, and --amount')

  return {
    from,
    to,
    amount,
    chain: flag(flags, 'chain') || 'base',
    fromAddress: flag(flags, 'from-address', 'fromAddress'),
    fromDecimals: num(flags, 'from-decimals', 'fromDecimals'),
    toAddress: flag(flags, 'to-address', 'toAddress'),
    toDecimals: num(flags, 'to-decimals', 'toDecimals'),
  }
}

async function cmdSolve(
  client: OrkidClient,
  flags: Record<string, string | boolean>
) {
  const req = routeRequest(flags)
  if (!req.fromAddress || req.fromDecimals === undefined) {
    die('solve requires --from-address and --from-decimals (token-in contract + decimals)')
  }

  const privateKey = flag(flags, 'private-key', 'privateKey') || process.env.ORKID_PRIVATE_KEY
  if (!privateKey) die('solve requires --private-key or ORKID_PRIVATE_KEY')

  let viem: any, accounts: any, chainsMod: any
  try {
    viem = await import('viem')
    accounts = await import('viem/accounts')
    chainsMod = await import('viem/chains')
  } catch {
    die('solve requires viem — run: npm install viem')
  }

  const { OrkidViemPermitSigner } = await import('./viem')
  const { chainConfigFromName } = await import('./chains')

  const chainConfig = chainConfigFromName(req.chain || 'base')
  const account = accounts.privateKeyToAccount(privateKey as `0x${string}`)
  const viemChain = Object.values(chainsMod).find((c: any) => c.id === chainConfig.id) as any
  if (!viemChain) die(`no viem chain config for chain id ${chainConfig.id}`)

  const walletClient = viem.createWalletClient({
    account,
    chain: viemChain,
    transport: viem.http(chainConfig.rpcUrl),
  })
  const publicClient = viem.createPublicClient({
    chain: viemChain,
    transport: viem.http(chainConfig.rpcUrl),
  })

  const user = flag(flags, 'user') || account.address
  const signer = new OrkidViemPermitSigner(walletClient, publicClient)

  const { permit, signature } = await signer.signSwap({
    user,
    fromToken: req.fromAddress,
    fromDecimals: req.fromDecimals,
    amount: req.amount,
    chain: req.chain || 'base',
  })

  const dryRun = !flags.execute
  if (!dryRun) {
    console.error('submitting live swap...')
  }

  const res = await client.solve({
    ...req,
    user,
    permit,
    signature,
    dryRun,
    slippageBps: num(flags, 'slippage-bps', 'slippageBps'),
  })

  // Below the gasless floor, live execution is refused — encode the swap and
  // submit it from the user's wallet (user pays gas). Requires ETH on the key.
  if (flags.execute && !res.ok && res.gaslessEligible === false) {
    console.error('below gasless minimum — submitting user-paid transaction...')
    const encoded = await client.solve({
      ...req,
      user,
      permit,
      signature,
      dryRun: true,
      slippageBps: num(flags, 'slippage-bps', 'slippageBps'),
    })
    if (!encoded.ok || !encoded.transaction?.data) return encoded

    const txHash = await walletClient.sendTransaction({
      to: encoded.transaction.to as `0x${string}`,
      data: encoded.transaction.data as `0x${string}`,
      value: BigInt(encoded.transaction.value || '0'),
    })
    console.error(`user-paid tx submitted: ${txHash} — waiting for confirmation...`)
    await publicClient.waitForTransactionReceipt({ hash: txHash })

    // Register the settled swap so the volume counts for the account.
    const confirm = await client.confirmTransaction(txHash, req.chain || 'base')
    if (!confirm.confirmed) {
      console.error(`warning: swap settled on-chain but not recorded (${confirm.error || 'confirm failed'})`)
    }

    return {
      ...encoded,
      transaction: { ...encoded.transaction, txHash },
    }
  }

  return res
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)))
