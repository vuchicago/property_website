-- Fictional values for isolated local testing. No production property or account data.
INSERT OR IGNORE INTO property_addresses
 (id,pin,address,normalized_address,city,zip_code,taxable_value,certified_land,certified_building,home_size,year_built,bedroom_count,bathroom_count,neighborhood_code,property_class,class_code,latitude,longitude,township_name)
VALUES
 (900001,'00000000000001','123 TEST AVE SKOKIE','123 TEST AVE SKOKIE','Skokie',60076,210000,40000,170000,1450,1965,3,2,'TEST','Residential','203',42.01,-87.72,'Niles'),
 (900002,'00000000000002','125 TEST AVE SKOKIE','125 TEST AVE SKOKIE','Skokie',60076,190000,38000,152000,1410,1966,3,2,'TEST','Residential','203',42.0102,-87.7202,'Niles'),
 (900003,'00000000000003','127 TEST AVE SKOKIE','127 TEST AVE SKOKIE','Skokie',60076,195000,39000,156000,1480,1964,3,2,'TEST','Residential','203',42.0104,-87.7204,'Niles'),
 (900004,'00000000000004','129 TEST AVE SKOKIE','129 TEST AVE SKOKIE','Skokie',60076,198000,39500,158500,1460,1967,3,2,'TEST','Residential','203',42.0106,-87.7206,'Niles'),
 (900005,'00000000000005','131 TEST AVE SKOKIE','131 TEST AVE SKOKIE','Skokie',60076,200000,40000,160000,1430,1963,3,2,'TEST','Residential','203',42.0108,-87.7208,'Niles');
INSERT OR IGNORE INTO property_address_search (property_key,id,pin,address,normalized_address)
SELECT normalized_address || '|pin:' || pin,id,pin,address,normalized_address FROM property_addresses WHERE id BETWEEN 900001 AND 900005;
