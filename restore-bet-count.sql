-- bet_countを元に戻すSQL（0点になってしまったデータ）

-- ID 121: umaren formation 3>1,8,14,17 → 4点
UPDATE bets SET bet_count = 4 WHERE id = 121;

-- ID 122: sanrenpuku formation 3>1,8,17>8,9,14,16,17 → 15点
UPDATE bets SET bet_count = 15 WHERE id = 122;

-- ID 125: wide formation 8>9,14,16,17 → 4点
UPDATE bets SET bet_count = 4 WHERE id = 125;

-- ID 126: wide formation 8>9,17 → 2点
UPDATE bets SET bet_count = 2 WHERE id = 126;

-- ID 133: umaren formation 11>1,2,4,9,12 → 5点
UPDATE bets SET bet_count = 5 WHERE id = 133;

-- ID 134: wide formation 9>11,14 → 2点
UPDATE bets SET bet_count = 2 WHERE id = 134;

-- ID 136: umaren formation 4,14>4,5,9,10,11,14 → 12点
UPDATE bets SET bet_count = 12 WHERE id = 136;

-- ID 137: sanrenpuku formation 4,14>4,5,9,10,11,14>3,4,5,9,10,11,14,15 → 96点
UPDATE bets SET bet_count = 96 WHERE id = 137;

-- ID 140: umaren formation 2>1,2,6,9,11,12,13,14,16 → 9点
UPDATE bets SET bet_count = 9 WHERE id = 140;

-- ID 141: sanrenpuku formation 2>9,10,13,14>6,9,10,11,12,13,14,16 → 32点
UPDATE bets SET bet_count = 32 WHERE id = 141;

-- ID 147: umatan formation 7,12,13,15>12,13 → 8点
UPDATE bets SET bet_count = 8 WHERE id = 147;

-- ID 148: umatan formation 9,14>4,9,14,15 → 8点
UPDATE bets SET bet_count = 8 WHERE id = 148;

-- ID 149: umatan formation 4,15>4,9,14,15 → 8点
UPDATE bets SET bet_count = 8 WHERE id = 149;

-- ID 152: sanrenpuku formation 2>10,12,13>9,10,12,13 → 12点
UPDATE bets SET bet_count = 12 WHERE id = 152;

-- ID 155: sanrenpuku formation 14>9,12>3,4,9,12 → 8点
UPDATE bets SET bet_count = 8 WHERE id = 155;
