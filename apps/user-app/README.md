# 📱 TurboPay - User Application

Frontend portal for TurboPayment end-users. Built with Next.js 14 App Router, NextAuth, and Tailwind CSS.

## Features
- **User Authentication**: Secure phone & password login via NextAuth Credentials provider.
- **Wallet Overview**: Live view of available and locked wallet balances.
- **Bank On-Ramp**: Add funds to the wallet via simulated bank deposits.
- **P2P Money Transfers**: Instant transfers with database row-level locking (`SELECT ... FOR UPDATE`).
- **QR Code Payments**: Render dynamic QR codes for settling merchant requests.
- **Transaction History**: Real-time status tracking for deposits and transfers.

## Local Development
Runs on port `3001` by default:
```bash
npm run dev
```
Access at [http://localhost:3001](http://localhost:3001).
