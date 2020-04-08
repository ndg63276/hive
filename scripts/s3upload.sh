#!/bin/bash

aws s3 sync . s3://smartathome.co.uk/hive/ --exclude ".git*" --exclude "scripts/*" --exclude "images/*"
