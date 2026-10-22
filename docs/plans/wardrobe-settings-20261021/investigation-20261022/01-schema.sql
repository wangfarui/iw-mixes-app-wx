-- Read-only local schema and aggregate inventory. No names, credentials or record bodies.
SELECT 'schema' section, DATABASE() db, VERSION() mysql_version, @@transaction_read_only tx_read_only;
SELECT table_name,column_name,column_type,is_nullable,column_default
FROM information_schema.columns
WHERE table_schema=DATABASE() AND table_name IN ('base_dict','wardrobe_item','wardrobe_outfit','wardrobe_outfit_item','wardrobe_wear_record','wardrobe_wear_record_item','auth_family_group','auth_family_member')
ORDER BY table_name,ordinal_position;
SELECT table_name,index_name,non_unique,GROUP_CONCAT(column_name ORDER BY seq_in_index) columns_list
FROM information_schema.statistics
WHERE table_schema=DATABASE() AND table_name IN ('base_dict','wardrobe_item','wardrobe_outfit','wardrobe_outfit_item','wardrobe_wear_record','wardrobe_wear_record_item')
GROUP BY table_name,index_name,non_unique ORDER BY table_name,index_name;
SELECT 'dict_inventory' section,dict_type,scope_type,COUNT(*) total,SUM(deleted=0) current_rows,SUM(deleted=1) deleted_rows,SUM(deleted=0 AND dict_status=1) enabled_rows,COUNT(DISTINCT user_id) owner_count
FROM base_dict WHERE dict_type BETWEEN 5001 AND 5006 GROUP BY dict_type,scope_type ORDER BY dict_type,scope_type;
SELECT 'wardrobe_item' tbl,COUNT(*) total,SUM(deleted=0) current_rows,COUNT(DISTINCT user_id) owners FROM wardrobe_item
UNION ALL SELECT 'wardrobe_outfit',COUNT(*),SUM(deleted=0),COUNT(DISTINCT user_id) FROM wardrobe_outfit
UNION ALL SELECT 'wardrobe_outfit_item',COUNT(*),SUM(deleted=0),COUNT(DISTINCT user_id) FROM wardrobe_outfit_item
UNION ALL SELECT 'wardrobe_wear_record',COUNT(*),SUM(deleted=0),COUNT(DISTINCT user_id) FROM wardrobe_wear_record
UNION ALL SELECT 'wardrobe_wear_record_item',COUNT(*),SUM(deleted=0),COUNT(DISTINCT user_id) FROM wardrobe_wear_record_item;
SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND (table_name LIKE '%audit%' OR table_name LIKE '%dict%' OR table_name LIKE '%history%') ORDER BY table_name;
