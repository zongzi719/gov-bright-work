import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Input, Button, Toast } from "antd-mobile";
import { supabase } from "@/integrations/supabase/client";

const H5Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (values: { mobile: string; password: string }) => {
    setLoading(true);
    try {
      // 验证登录
      const { data, error } = await supabase.rpc("verify_contact_login", {
        p_mobile: values.mobile,
        p_password: values.password,
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const contact = data[0];
        
        // 检查是否是领导
        const { data: contactData } = await supabase
          .from("contacts")
          .select("is_leader")
          .eq("id", contact.contact_id)
          .single();

        if (!contactData?.is_leader) {
          Toast.show({
            icon: "fail",
            content: "仅限领导登录",
          });
          setLoading(false);
          return;
        }

        // 存储用户信息
        const userInfo = {
          id: contact.contact_id,
          name: contact.contact_name,
          mobile: contact.contact_mobile,
          position: contact.contact_position,
          department: contact.contact_department,
          organization: contact.organization_name,
          security_level: contact.contact_security_level,
          is_leader: true,
        };
        localStorage.setItem("h5User", JSON.stringify(userInfo));

        Toast.show({
          icon: "success",
          content: "登录成功",
        });

        navigate("/h5officialdocument");
      } else {
        Toast.show({
          icon: "fail",
          content: "手机号或密码错误",
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      Toast.show({
        icon: "fail",
        content: "登录失败，请重试",
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background flex flex-col">
      {/* Header */}
      <div className="pt-16 pb-8 px-6 text-center">
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
          <span className="text-4xl">📋</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">公文办理系统</h1>
        <p className="text-sm text-muted-foreground mt-2">领导专用移动端</p>
      </div>

      {/* Login Form */}
      <div className="flex-1 px-6">
        <div className="bg-background rounded-2xl shadow-lg p-6">
          <Form
            layout="vertical"
            onFinish={handleLogin}
            footer={
              <Button
                block
                type="submit"
                color="primary"
                size="large"
                loading={loading}
                className="mt-4"
                style={{ borderRadius: "12px", height: "48px" }}
              >
                登 录
              </Button>
            }
          >
            <Form.Item
              name="mobile"
              label="账号"
              rules={[{ required: true, message: "请输入账号" }]}
            >
              <Input
                placeholder="请输入账号"
                clearable
                style={{
                  "--font-size": "16px",
                  "--placeholder-color": "var(--adm-color-light)",
                }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: "请输入密码" }]}
            >
              <Input
                type="password"
                placeholder="请输入密码"
                clearable
                style={{
                  "--font-size": "16px",
                  "--placeholder-color": "var(--adm-color-light)",
                }}
              />
            </Form.Item>
          </Form>
        </div>

        {/* Tips */}
        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            仅限领导人员登录使用
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            如需帮助，请联系办公室
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="py-6 text-center">
        <p className="text-xs text-muted-foreground">© 2025 公文办理系统</p>
      </div>
    </div>
  );
};

export default H5Login;
