"""Compatibility entry point. Superseded by the unified reviewed release installer."""
from apply_upgrade import apply
from pathlib import Path
import argparse
if __name__=="__main__":
 p=argparse.ArgumentParser();p.add_argument("--target",type=Path,required=True);p.add_argument("--check",action="store_true");p.add_argument("--restart",action="store_true");o=p.parse_args();apply(o.target,restart=o.restart,check=o.check)
