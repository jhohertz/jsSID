
use Data::Dumper;
use IO::File;

require 'wavedata.inc';

print "Sizes\n";
print "waveform50_6581: " . $#waveform50_6581 . "\n";
print "waveform30_8580: " . $#waveform30_8580 . "\n";
print "waveform50_8580: " . $#waveform50_8580 . "\n";
print "waveform60_8580: " . $#waveform60_8580 . "\n";
print "waveform70_8580: " . $#waveform70_8580 . "\n";

$fh = IO::File->new("wavedata.dat", "w");

foreach $byte (@waveform30_8580) {
	print $fh chr($byte);
}

foreach $byte (@waveform50_8580) {
	print $fh chr($byte);
}

foreach $byte (@waveform60_8580) {
	print $fh chr($byte);
}

foreach $byte (@waveform70_8580) {
	print $fh chr($byte);
}

foreach $byte (@waveform50_6581) {
	print $fh chr($byte);
}

$fh->close;
