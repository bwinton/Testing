#!/usr/bin/env python

from collections import Counter
import json
from mercurial import cmdutil, commands, hg, ui, url
from optparse import OptionParser
import os
import re
import requests
import sys

aliases = { "callekr": "callek",
            "dbienvenu": "bienvenu",
            "lw": "luke",
            "philringnalda": "philor",
          }

fileRe = re.compile(r"^\+\+\+ (?:b/)?([^\s]*)", re.MULTILINE)
suckerRe = re.compile(r"[^s-]r=(\w+)")
supersuckerRe = re.compile(r"sr=(\w+)")
uisuckerRe = re.compile(r"ui-r=(\w+)")

def canon(reviewer):
  reviewer = reviewer.lower()
  return aliases.get(reviewer, reviewer)

def main(argv=None):
  if argv is None:
    argv = sys.argv
  parser = OptionParser()

  (options, args) = parser.parse_args()

  myui = ui.ui()
  repo = hg.repository(myui, cmdutil.findrepo(os.getcwd()))

  changes = {}

  for revNum in xrange(len(repo)):
    rev = repo[revNum]
    for file in rev.files():
      changes.setdefault(file, []).append(rev)

  postval = {}

  for file in changes:
    postval[file] = {"reviewers": {},
                     "super-reviewers": {},
                     "ui-reviewers": {}
                    }
    for change in changes[file]:
      for person in (canon(x) for x in suckerRe.findall(change.description())):
        postval[file]["reviewers"][person] = postval[file]["reviewers"].setdefault(person, 0) + 1
      for person in (canon(x) for x in supersuckerRe.findall(change.description())):
        postval[file]["super-reviewers"][person] = postval[file]["super-reviewers"].setdefault(person, 0) + 1
      for person in (canon(x) for x in uisuckerRe.findall(change.description())):
        postval[file]["ui-reviewers"][person] = postval[file]["ui-reviewers"].setdefault(person, 0) + 1

  print len(postval)
  size = len(postval) / 15
  curr = {}
  index = 0
  while len(postval):
    curr.clear()
    index += 1
    for i in xrange(size):
      try:
        item = postval.popitem()
        curr[item[0]] = item[1]
      except KeyError:
        break
    print "Writing "+str(len(curr))+" keys to "+argv[1]+str(index)+".json"
    f = open(argv[1] + str(index) + ".json", "w")
    f.write(json.dumps(curr))
    f.close()
  return 0

if __name__ == "__main__":
    sys.exit(main())

