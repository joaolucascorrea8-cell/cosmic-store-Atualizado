import FloatingChat from "./FloatingChat";
import { createClient } from "@/lib/supabase/server";

export default async function FloatingChatServer(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return null;const {count}=await supabase.from("notifications").select("id",{count:"exact",head:true}).eq("user_id",user.id).is("read_at",null);return <FloatingChat unread={count??0} userId={user.id}/>;}
