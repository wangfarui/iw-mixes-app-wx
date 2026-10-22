-- Read-only bounded tokens and aggregate checks; no clothing names, accounts or credentials.
SELECT 'nonnumeric_tag_fields' section,'ITEM' kind,id row_id,deleted,5004 dict_type,scene_tags tokens FROM wardrobe_item WHERE scene_tags<>'' AND NOT REGEXP_LIKE(scene_tags,'^[0-9]+(,[0-9]+)*$')
UNION ALL SELECT 'nonnumeric_tag_fields','ITEM',id,deleted,5005,style_tags FROM wardrobe_item WHERE style_tags<>'' AND NOT REGEXP_LIKE(style_tags,'^[0-9]+(,[0-9]+)*$')
UNION ALL SELECT 'nonnumeric_tag_fields','OUTFIT',id,deleted,5004,scene_tags FROM wardrobe_outfit WHERE scene_tags<>'' AND NOT REGEXP_LIKE(scene_tags,'^[0-9]+(,[0-9]+)*$')
UNION ALL SELECT 'nonnumeric_tag_fields','OUTFIT',id,deleted,5005,style_tags FROM wardrobe_outfit WHERE style_tags<>'' AND NOT REGEXP_LIKE(style_tags,'^[0-9]+(,[0-9]+)*$')
UNION ALL SELECT 'nonnumeric_tag_fields','RECORD',id,deleted,5004,scene_tags FROM wardrobe_wear_record WHERE scene_tags<>'' AND NOT REGEXP_LIKE(scene_tags,'^[0-9]+(,[0-9]+)*$');
SELECT 'template_values' section,dict_type,dict_code,dict_name,parent_id,id FROM base_dict WHERE user_id=0 AND scope_type=0 AND family_group_id=0 AND dict_type IN (5002,5003,5004,5005,5006) AND deleted=0 ORDER BY dict_type,dict_code;
SELECT 'dict_deleted_row' section,dict_type,dict_code,dict_name FROM base_dict WHERE dict_type IN (5002,5003,5004,5005,5006) AND deleted=1;
SELECT 'active_item_temporal_dictionary' section,COUNT(*) rows_count,
 SUM(EXISTS(SELECT 1 FROM base_dict d WHERE d.user_id=i.user_id AND d.dict_type=5005 AND d.update_time>i.create_time)) owner_dict_changed_after_item
FROM wardrobe_item i WHERE i.deleted=0;
SELECT 'table_engine_collation' section,table_name,engine,table_collation FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('base_dict','wardrobe_item','wardrobe_outfit','wardrobe_outfit_item','wardrobe_wear_record','wardrobe_wear_record_item');
SELECT 'dict_generated_expression' section,column_name,generation_expression FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='base_dict' AND extra LIKE '%GENERATED%';
SELECT 'item_owner_membership' section,COUNT(DISTINCT i.user_id) wardrobe_owners,
 COUNT(DISTINCT IF(u.id IS NULL OR u.deleted=1,i.user_id,NULL)) missing_active_user,
 COUNT(DISTINCT IF(g.id IS NOT NULL AND m.id IS NOT NULL,i.user_id,NULL)) owners_in_active_family
FROM wardrobe_item i LEFT JOIN auth_user u ON u.id=i.user_id
LEFT JOIN auth_family_group g ON g.id=u.family_group_id AND g.deleted=0 AND g.status=1
LEFT JOIN auth_family_member m ON m.group_id=g.id AND m.user_id=u.id AND m.deleted=0 AND m.status=1;
