# Archived Hooks

This directory contains hooks that are currently disabled but preserved for future implementation.

## Available Archived Hooks

### 1. useContractDeployment

**File:** `hooks/archived/useContractDeployment.ts`  
**Status:** Disabled  
**Purpose:** Handles Stellar smart contract deployment  
**Requires:** Backend API support for contract deployment  
**Usage:**

```typescript
const { handleDeployContract } = useContractDeployment({
  userId,
  publicKey,
  logToTerminal,
  onContractLoading,
  onError,
  onTerminalOpen,
});
```

### 2. useAccountCreation

**File:** `hooks/archived/useAccountCreation.ts`  
**Status:** Disabled  
**Purpose:** Handles Stellar account creation in Soroban environment  
**Requires:** Backend API support for account creation  
**Usage:**

```typescript
const { handleCreateAccount } = useAccountCreation({
  userId,
  logToTerminal,
  onAccountLoading,
  onError,
  onTerminalOpen,
});
```

## How to Re-enable

To use any of these hooks:

1. Copy the hook import to your component
2. Call the hook with required props
3. Use the returned handler function
4. Update backend API endpoint if needed
5. Remove from archived folder when fully implemented

## Notes

- These hooks follow the same pattern as active hooks
- All required dependencies are included
- Error handling and logging are pre-configured
- Docker API integration is ready (awaiting backend implementation)

Last Updated: 2025-12-28
