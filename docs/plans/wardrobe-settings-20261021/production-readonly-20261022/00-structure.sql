-- Metadata only. Select the real production application database before running.
SELECT 'P00_ENVIRONMENT' AS check_id,DATABASE() AS target_database,VERSION() AS mysql_version,NOW() AS database_time,@@read_only AS server_read_only;

-- Gate for 01-data-quality.sql. No application-table queries are performed here.
SELECT 'P01_REQUIRED_STRUCTURE' AS check_id,
 CASE WHEN DATABASE() IS NULL THEN 'STOP_NO_DATABASE'
      WHEN VERSION() NOT REGEXP '^8[.]' OR VERSION() LIKE '%MariaDB%' THEN 'STOP_REVIEW_VERSION'
      WHEN SUM(c.column_name IS NULL)>0 THEN 'STOP_MISSING_COLUMNS'
      ELSE 'READY_MYSQL8' END AS next_step,
 SUM(c.column_name IS NULL) AS missing_column_count,
 GROUP_CONCAT(IF(c.column_name IS NULL,CONCAT(r.tbl,'.',r.col),NULL) ORDER BY r.tbl,r.col SEPARATOR ', ') AS missing_columns
FROM (
 SELECT 'base_dict' tbl,'id' col UNION ALL SELECT 'base_dict','user_id'
 UNION ALL SELECT 'base_dict','dict_type' UNION ALL SELECT 'base_dict','dict_code'
 UNION ALL SELECT 'base_dict','dict_name' UNION ALL SELECT 'base_dict','dict_status'
 UNION ALL SELECT 'base_dict','parent_id' UNION ALL SELECT 'base_dict','deleted'
 UNION ALL SELECT 'base_dict','scope_type' UNION ALL SELECT 'base_dict','family_group_id'
 UNION ALL SELECT 'base_dict','previous_id' UNION ALL SELECT 'base_dict','revision'
 UNION ALL SELECT 'base_dict','create_time' UNION ALL SELECT 'base_dict','update_time'
 UNION ALL SELECT 'wardrobe_item','id' UNION ALL SELECT 'wardrobe_item','user_id'
 UNION ALL SELECT 'wardrobe_item','deleted' UNION ALL SELECT 'wardrobe_item','category'
 UNION ALL SELECT 'wardrobe_item','item_style' UNION ALL SELECT 'wardrobe_item','color_name'
 UNION ALL SELECT 'wardrobe_item','scene_tags' UNION ALL SELECT 'wardrobe_item','style_tags'
 UNION ALL SELECT 'wardrobe_outfit','id' UNION ALL SELECT 'wardrobe_outfit','user_id'
 UNION ALL SELECT 'wardrobe_outfit','deleted' UNION ALL SELECT 'wardrobe_outfit','scene_tags'
 UNION ALL SELECT 'wardrobe_outfit','style_tags'
 UNION ALL SELECT 'wardrobe_outfit_item','id' UNION ALL SELECT 'wardrobe_outfit_item','user_id'
 UNION ALL SELECT 'wardrobe_outfit_item','deleted' UNION ALL SELECT 'wardrobe_outfit_item','category'
 UNION ALL SELECT 'wardrobe_outfit_item','item_style' UNION ALL SELECT 'wardrobe_outfit_item','item_id'
 UNION ALL SELECT 'wardrobe_outfit_item','outfit_id'
 UNION ALL SELECT 'wardrobe_wear_record','id' UNION ALL SELECT 'wardrobe_wear_record','user_id'
 UNION ALL SELECT 'wardrobe_wear_record','deleted' UNION ALL SELECT 'wardrobe_wear_record','scene_tags'
 UNION ALL SELECT 'wardrobe_wear_record_item','id' UNION ALL SELECT 'wardrobe_wear_record_item','user_id'
 UNION ALL SELECT 'wardrobe_wear_record_item','deleted' UNION ALL SELECT 'wardrobe_wear_record_item','category'
 UNION ALL SELECT 'wardrobe_wear_record_item','item_style' UNION ALL SELECT 'wardrobe_wear_record_item','item_id'
 UNION ALL SELECT 'wardrobe_wear_record_item','record_id'
) r
LEFT JOIN information_schema.columns c ON c.table_schema=DATABASE() AND c.table_name=r.tbl AND c.column_name=r.col;

SELECT 'P02_TABLES' AS check_id,table_name,engine,table_rows AS estimated_rows,table_collation
FROM information_schema.tables
WHERE table_schema=DATABASE() AND table_name IN ('base_dict','wardrobe_item','wardrobe_outfit','wardrobe_outfit_item','wardrobe_wear_record','wardrobe_wear_record_item')
ORDER BY table_name;

SELECT 'P03_COLUMNS' AS check_id,table_name,column_name,column_type,is_nullable,column_default,extra
FROM information_schema.columns
WHERE table_schema=DATABASE() AND table_name IN ('base_dict','wardrobe_item','wardrobe_outfit','wardrobe_outfit_item','wardrobe_wear_record','wardrobe_wear_record_item')
AND (column_name IN ('id','user_id','parent_id','dict_type','dict_code','dict_name','dict_status','scope_type','family_group_id','previous_id','revision','active_name_key','category','item_style','color_name','scene_tags','style_tags','deleted')
 OR column_name LIKE '%snapshot%' OR column_name LIKE '%source%' OR column_name LIKE 'wardrobe_%')
ORDER BY table_name,ordinal_position;

SELECT 'P04_INDEXES' AS check_id,table_name,index_name,non_unique,GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS index_columns
FROM information_schema.statistics
WHERE table_schema=DATABASE() AND table_name IN ('base_dict','wardrobe_item','wardrobe_outfit','wardrobe_outfit_item','wardrobe_wear_record','wardrobe_wear_record_item')
GROUP BY table_name,index_name,non_unique ORDER BY table_name,index_name;

SELECT 'P05_EXISTING_DICTIONARY_STRUCTURES' AS check_id,table_name
FROM information_schema.tables
WHERE table_schema=DATABASE() AND (table_name LIKE '%dictionary%' OR table_name LIKE '%dict%state%' OR table_name LIKE '%dict%migrat%' OR table_name LIKE '%wardrobe%snapshot%')
ORDER BY table_name;
