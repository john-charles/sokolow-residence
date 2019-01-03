#!/usr/bin/env python3


import os, sys, time, subprocess

script_dir = os.path.dirname(sys.argv[0])


home = os.path.expanduser('~')
normalized_cwd = os.getcwd().replace(home, '~')
now_stamp = time.time()
current_time = time.strftime("%I:%M:%S%p").lower()

temps_file = os.path.join(home, ".temps.txt")

gen_script = os.path.join(script_dir, "residence-generate-temps.js")

# print(os.stat(temps_file).st_mtime, now_stamp - 30)
# print(now_stamp - os.stat(temps_file).st_mtime)

if not os.path.exists(temps_file):
    subprocess.call(gen_script)

elif now_stamp - os.stat(temps_file).st_mtime > 30:
    subprocess.run("%s &" % gen_script, shell=True)

temps = open(temps_file, 'rb').read()



print ('%s %s\n%s $ ' % (temps, normalized_cwd, current_time))