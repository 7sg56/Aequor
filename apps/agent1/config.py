import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SOLANA_RPC_URL = os.getenv("SOLANA_RPC_URL", "http://127.0.0.1:8899")
    SOLANA_KEYPAIR_PATH = os.getenv("SOLANA_KEYPAIR_PATH", "~/.config/solana/id.json")
    PLATFORM_API_KEY = os.getenv("PLATFORM_API_KEY", "")
    SWARM_BUS_PROGRAM_ID = os.getenv("SWARM_BUS_PROGRAM_ID", "")

config = Config()
