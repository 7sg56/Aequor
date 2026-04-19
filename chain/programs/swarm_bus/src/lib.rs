use anchor_lang::prelude::*;

declare_id!("G9ADiy7bb4bfqjEbihS8Mfaq1VSv7NvVRzyiQrFVjDSE");

#[program]
pub mod swarm_bus {
    use super::*;

    /// Emits a new work signal from an authorized agent (like Argus).
    /// The signal is stored in a PDA derived from the signal_id.
    pub fn emit_work_signal(
        ctx: Context<EmitWorkSignal>,
        signal_id: String,
        schema_version: u32,
        payload: String,
    ) -> Result<()> {
        let signal_account = &mut ctx.accounts.signal_account;
        
        signal_account.authority = ctx.accounts.authority.key();
        signal_account.signal_id = signal_id;
        signal_account.schema_version = schema_version;
        signal_account.payload = payload;
        signal_account.timestamp = Clock::get()?.unix_timestamp;

        msg!("WorkSignal emitted: {}", signal_account.signal_id);
        
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(signal_id: String, schema_version: u32, payload: String)]
pub struct EmitWorkSignal<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + WorkSignalAccount::INIT_SPACE + payload.len(),
        seeds = [b"work_signal", signal_id.as_bytes()],
        bump
    )]
    pub signal_account: Account<'info, WorkSignalAccount>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[account]
pub struct WorkSignalAccount {
    pub authority: Pubkey,
    pub signal_id: String,
    pub schema_version: u32,
    pub payload: String,
    pub timestamp: i64,
}

impl WorkSignalAccount {
    // 32 (pubkey) + 4 (string length prefix) + 32 (uuid max length) + 4 (u32) + 4 (string length prefix) + 8 (i64)
    pub const INIT_SPACE: usize = 32 + 4 + 32 + 4 + 4 + 8;
}