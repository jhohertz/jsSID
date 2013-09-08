./samp2src.pl wave6581__ST wave6581__ST.dat wave6581__ST.js
./samp2src.pl wave6581_P_T wave6581_P_T.dat wave6581_P_T.js
./samp2src.pl wave6581_PS_ wave6581_PS_.dat wave6581_PS_.js
./samp2src.pl wave6581_PST wave6581_PST.dat wave6581_PST.js
./samp2src.pl wave8580__ST wave8580__ST.dat wave8580__ST.js
./samp2src.pl wave8580_P_T wave8580_P_T.dat wave8580_P_T.js
./samp2src.pl wave8580_PS_ wave8580_PS_.dat wave8580_PS_.js
./samp2src.pl wave8580_PST wave8580_PST.dat wave8580_PST.js

cat wave6581__ST.js > resid-data.js
cat wave6581_P_T.js >> resid-data.js
cat wave6581_PS_.js >> resid-data.js
cat wave6581_PST.js >> resid-data.js
cat wave8580__ST.js >> resid-data.js
cat wave8580_P_T.js >> resid-data.js
cat wave8580_PS_.js >> resid-data.js
cat wave8580_PST.js >> resid-data.js

cat wave6581__ST.dat > resid-data.dat
cat wave6581_P_T.dat >> resid-data.dat
cat wave6581_PS_.dat >> resid-data.dat
cat wave6581_PST.dat >> resid-data.dat
cat wave8580__ST.dat >> resid-data.dat
cat wave8580_P_T.dat >> resid-data.dat
cat wave8580_PS_.dat >> resid-data.dat
cat wave8580_PST.dat >> resid-data.dat

cat resid-data.dat | gzip -9 | base64 > resid-data.gz.base64

echo "WaveGenerator.comboTable = " > resid-data.base64.js
cat resid-data.gz.base64 | awk '{print "	\""$1"\" +"}' >> resid-data.base64.js

