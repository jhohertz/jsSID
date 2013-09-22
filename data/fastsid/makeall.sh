perl makedat.pl

cat wavedata.dat | gzip -9 | base64 > wavedata.gz.base64

echo "FastSID.comboTable = " > wavedata.base64.js
cat wavedata.gz.base64 | awk '{print "	\""$1"\" +"}' >> wavedata.base64.js

cat wavedata.base64.js

