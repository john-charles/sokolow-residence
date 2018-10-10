#!/usr/bin/env bash

npm i && \
    echo "Creating zip archive" && \
    zip -r lambda.zip . -x 'lambda.zip' -x '.terraform/*' -x '.git/*' -x '.idea/*' > /dev/null && \
    echo "Executing terraform!" && terraform apply
