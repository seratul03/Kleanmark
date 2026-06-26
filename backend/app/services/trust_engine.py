from app.database import supabase

def calculate_trust_score(vendor_id: str) -> float:
    # 1. Checklist Score (30 points)
    # Total questions = 18
    checklist_res = supabase.table("checklist_answers").select("answer").eq("vendor_id", vendor_id).execute()
    yes_count = sum(1 for item in checklist_res.data if item["answer"] is True)
    checklist_pct = (yes_count / 18) * 30 if checklist_res.data else 0

    # 2. Image Score (50 points)
    # 5 categories max. Each image gives vendor_score (5) + admin_score (0-5)
    images_res = supabase.table("proof_images").select("image_type, vendor_score, admin_score").eq("vendor_id", vendor_id).eq("is_current", True).execute()
    image_pct = 0
    seen_types = set()
    if images_res.data:
        for img in images_res.data:
            if img["image_type"] not in seen_types:
                seen_types.add(img["image_type"])
                v_score = img.get("vendor_score", 0) or 0
                a_score = img.get("admin_score", 0) or 0
                image_pct += (v_score + a_score)
    image_pct = min(image_pct, 50)

    # 3. Freshness Score (20 points)
    vendor_res = supabase.table("vendors").select("active").eq("id", vendor_id).execute()
    is_active = vendor_res.data[0]["active"] if vendor_res.data else False
    freshness_pct = 20 if is_active else 0

    final_score = round(checklist_pct + image_pct + freshness_pct, 2)

    # Update the score in the database
    supabase.table("vendors").update({"trust_score": final_score}).eq("id", vendor_id).execute()

    return final_score

def get_trust_level(score: float) -> str:
    if score >= 90:
        return "Excellent"
    elif score >= 70:
        return "Good"
    elif score >= 50:
        return "Average"
    else:
        return "Poor"
