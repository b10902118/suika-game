#!/bin/bash
ssh -NR 2001:localhost:2001 dev &
python3 -m http.server 2001
