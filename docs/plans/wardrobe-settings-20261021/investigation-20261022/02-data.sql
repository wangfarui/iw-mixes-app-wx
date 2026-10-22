-- Read-only data quality checks. Deleted rows are retained in the investigation scope.
SELECT 'dictionary_scopes' section,dict_type,(user_id=0) template_owner,scope_type,COUNT(*) total,SUM(deleted=0) current_rows,COUNT(DISTINCT user_id) owners
FROM base_dict WHERE dict_type IN (5002,5003,5004,5005,5006) GROUP BY dict_type,(user_id=0),scope_type ORDER BY dict_type,template_owner;
SELECT 'duplicate_current_codes' section,COUNT(*) duplicate_groups FROM (
 SELECT user_id,scope_type,family_group_id,dict_type,dict_code,COUNT(*) n FROM base_dict
 WHERE dict_type IN (5002,5003,5004,5005,5006) AND deleted=0
 GROUP BY user_id,scope_type,family_group_id,dict_type,dict_code HAVING COUNT(*)>1
) d;
SELECT 'duplicate_current_names' section,COUNT(*) duplicate_groups FROM (
 SELECT user_id,scope_type,family_group_id,dict_type,IF(dict_type=5006,parent_id,0) parent_key,CONVERT(TRIM(dict_name) USING binary) name_key,COUNT(*) n FROM base_dict
 WHERE dict_type IN (5002,5003,5004,5005,5006) AND deleted=0
 GROUP BY user_id,scope_type,family_group_id,dict_type,parent_key,name_key HAVING COUNT(*)>1
) d;
SELECT 'subcategory_parents' section,COUNT(*) total,
 SUM(p.id IS NULL) missing_parent,SUM(p.dict_type<>5002) wrong_type,
 SUM(p.user_id<>c.user_id OR p.scope_type<>c.scope_type OR p.family_group_id<>c.family_group_id) wrong_owner,
 SUM(p.deleted=1) deleted_parent,SUM(p.dict_status=0) disabled_parent
FROM base_dict c LEFT JOIN base_dict p ON p.id=c.parent_id WHERE c.dict_type=5006 AND c.deleted=0;
WITH refs AS (
 SELECT 'ITEM' kind,id row_id,user_id,category,item_style,deleted FROM wardrobe_item
 UNION ALL SELECT 'OUTFIT_ITEM',id,user_id,category,item_style,deleted FROM wardrobe_outfit_item
 UNION ALL SELECT 'RECORD_ITEM',id,user_id,category,item_style,deleted FROM wardrobe_wear_record_item
), mapped AS (
 SELECT r.*,
 (SELECT COUNT(*) FROM base_dict d WHERE d.user_id=r.user_id AND d.scope_type=0 AND d.family_group_id=0 AND d.dict_type=5002 AND d.dict_code=r.category AND d.deleted=0) personal_category,
 (SELECT COUNT(*) FROM base_dict d WHERE d.user_id=0 AND d.scope_type=0 AND d.family_group_id=0 AND d.dict_type=5002 AND d.dict_code=r.category AND d.deleted=0) template_category,
 (SELECT COUNT(*) FROM base_dict d WHERE d.user_id=r.user_id AND d.scope_type=0 AND d.family_group_id=0 AND d.dict_type=5006 AND d.dict_code=r.item_style AND d.deleted=0) personal_style,
 (SELECT COUNT(*) FROM base_dict d WHERE d.user_id=0 AND d.scope_type=0 AND d.family_group_id=0 AND d.dict_type=5006 AND d.dict_code=r.item_style AND d.deleted=0) template_style
 FROM refs r
)
SELECT 'code_source_mapping' section,kind,deleted,COUNT(*) rows_count,
 SUM(category=0) category_unset,SUM(category<>0 AND personal_category=1) category_personal_unique,
 SUM(category<>0 AND personal_category=0 AND template_category=1) category_template_only,
 SUM(category<>0 AND personal_category=0 AND template_category=0) category_unknown,
 SUM(item_style=0) style_unset,SUM(item_style<>0 AND personal_style=1) style_personal_unique,
 SUM(item_style<>0 AND personal_style=0 AND template_style=1) style_template_only,
 SUM(item_style<>0 AND personal_style=0 AND template_style=0) style_unknown
FROM mapped GROUP BY kind,deleted ORDER BY kind,deleted;
WITH refs AS (
 SELECT 'ITEM' kind,id row_id,user_id,category,item_style FROM wardrobe_item
 UNION ALL SELECT 'OUTFIT_ITEM',id,user_id,category,item_style FROM wardrobe_outfit_item
 UNION ALL SELECT 'RECORD_ITEM',id,user_id,category,item_style FROM wardrobe_wear_record_item
)
SELECT 'style_category_mismatch' section,kind,COUNT(*) mismatch_count
FROM refs r JOIN base_dict s ON s.user_id=0 AND s.scope_type=0 AND s.family_group_id=0 AND s.dict_type=5006 AND s.dict_code=r.item_style AND s.deleted=0
JOIN base_dict p ON p.id=s.parent_id
WHERE r.item_style<>0 AND p.dict_code<>r.category GROUP BY kind;
WITH fields AS (
 SELECT 'ITEM' kind,id row_id,user_id,deleted,5004 dict_type,scene_tags tags FROM wardrobe_item
 UNION ALL SELECT 'ITEM',id,user_id,deleted,5005,style_tags FROM wardrobe_item
 UNION ALL SELECT 'OUTFIT',id,user_id,deleted,5004,scene_tags FROM wardrobe_outfit
 UNION ALL SELECT 'OUTFIT',id,user_id,deleted,5005,style_tags FROM wardrobe_outfit
 UNION ALL SELECT 'RECORD',id,user_id,deleted,5004,scene_tags FROM wardrobe_wear_record
)
SELECT 'tag_format' section,kind,dict_type,COUNT(*) field_count,SUM(tags='') empty_count,SUM(tags<>'' AND NOT REGEXP_LIKE(tags,'^[0-9]+(,[0-9]+)*$')) malformed_count
FROM fields GROUP BY kind,dict_type ORDER BY kind,dict_type;
WITH fields AS (
 SELECT 'ITEM' kind,id row_id,user_id,deleted,5004 dict_type,scene_tags tags FROM wardrobe_item
 UNION ALL SELECT 'ITEM',id,user_id,deleted,5005,style_tags FROM wardrobe_item
 UNION ALL SELECT 'OUTFIT',id,user_id,deleted,5004,scene_tags FROM wardrobe_outfit
 UNION ALL SELECT 'OUTFIT',id,user_id,deleted,5005,style_tags FROM wardrobe_outfit
 UNION ALL SELECT 'RECORD',id,user_id,deleted,5004,scene_tags FROM wardrobe_wear_record
), tokens AS (
 SELECT f.*,j.code FROM fields f JOIN JSON_TABLE(IF(REGEXP_LIKE(tags,'^[0-9]+(,[0-9]+)*$'),CONCAT('[',tags,']'),'[]'),'$[*]' COLUMNS(code INT PATH '$')) j
), mapped AS (
 SELECT t.*,
 (SELECT COUNT(*) FROM base_dict d WHERE d.user_id=t.user_id AND d.scope_type=0 AND d.family_group_id=0 AND d.dict_type=t.dict_type AND d.dict_code=t.code AND d.deleted=0) current_sources,
 (SELECT COUNT(*) FROM base_dict d WHERE d.user_id=t.user_id AND d.scope_type=0 AND d.family_group_id=0 AND d.dict_type=t.dict_type AND d.dict_code=t.code) all_sources,
 (SELECT COUNT(*) FROM base_dict d WHERE d.user_id=0 AND d.scope_type=0 AND d.family_group_id=0 AND d.dict_type=t.dict_type AND d.dict_code=t.code AND d.deleted=0) template_sources
 FROM tokens t
)
SELECT 'tag_source_mapping' section,kind,dict_type,deleted,COUNT(*) token_count,
 SUM(current_sources=1) personal_unique,SUM(current_sources=0 AND all_sources=1) deleted_personal_unique,
 SUM(current_sources=0 AND all_sources=0 AND template_sources=1) template_only,
 SUM(all_sources=0 AND template_sources=0) unknown_count,SUM(all_sources>1) history_ambiguous
FROM mapped GROUP BY kind,dict_type,deleted ORDER BY kind,dict_type,deleted;
SELECT 'color_mapping' section,deleted,COUNT(*) rows_count,SUM(color_name='') empty_color,
 SUM(color_name<>'' AND (SELECT COUNT(*) FROM base_dict d WHERE d.dict_type=5003 AND d.user_id=i.user_id AND d.scope_type=0 AND d.family_group_id=0 AND d.deleted=0 AND CONVERT(d.dict_name USING binary)=CONVERT(i.color_name USING binary))=1) personal_exact,
 SUM(color_name<>'' AND (SELECT COUNT(*) FROM base_dict d WHERE d.dict_type=5003 AND d.user_id=i.user_id AND d.scope_type=0 AND d.family_group_id=0 AND CONVERT(d.dict_name USING binary)=CONVERT(i.color_name USING binary))=0) no_source_name
FROM wardrobe_item i GROUP BY deleted;
SELECT 'relation_owner_drift' section,'OUTFIT_ITEM' kind,COUNT(*) rows_count,SUM(i.id IS NULL) missing_item,SUM(i.deleted=1) item_deleted,SUM(i.user_id<>r.user_id) current_owner_differs
FROM wardrobe_outfit_item r LEFT JOIN wardrobe_item i ON i.id=r.item_id
UNION ALL SELECT 'relation_owner_drift','RECORD_ITEM',COUNT(*),SUM(i.id IS NULL),SUM(i.deleted=1),SUM(i.user_id<>r.user_id)
FROM wardrobe_wear_record_item r LEFT JOIN wardrobe_item i ON i.id=r.item_id;
SELECT 'family_inventory' section,COUNT(*) total,SUM(deleted=0 AND status=1) active_groups FROM auth_family_group;
SELECT 'current_dictionary_lineage' section,COUNT(*) rows_count,SUM(previous_id IS NOT NULL) previous_links,SUM(revision<>0) revised_rows FROM base_dict WHERE dict_type IN (5002,5003,5004,5005,5006);
