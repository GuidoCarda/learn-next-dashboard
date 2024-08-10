"use server";

import { signIn } from "@/auth";
import { sql } from "@vercel/postgres";
import { error } from "console";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

export type InvoiceState = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

export type CustomerState = {
  errors?: {
    name?: string[];
    email?: string[];
    // image_url?: string[];
  };
  message?: string | null;
};

const InvoiceFormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: "Please select a customer",
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: "Please enter an amount greater than $0" }),
  status: z.enum(["pending", "paid"], {
    message: "Please select an invoice status",
  }),
  date: z.string(),
});

const CustomerFormSchema = z.object({
  id: z.string(),
  name: z.string().min(0, {
    message: "test",
  }),
  email: z
    .string({
      message: "Required field",
    })
    .email({
      message: "A valid email is required",
    }),
});

const CreateInvoice = InvoiceFormSchema.omit({ id: true, date: true });
const CreateCustomer = CustomerFormSchema.omit({ id: true });

export async function createInvoice(
  prevState: InvoiceState,
  formData: FormData
) {
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Missing fields. Failed to create Invoice",
    };
  }

  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split("T")[0];

  try {
    await sql`
    INSERT INTO invoices (customer_id, amount, status, date)
    VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
  `;
  } catch (error) {
    return {
      message: "Database Error: Failed to create invoice",
    };
  }

  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

const UpdateInvoice = InvoiceFormSchema.omit({ id: true, date: true });

export async function updateInvoice(
  id: string,
  prevState: InvoiceState,
  formData: FormData
) {
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Missing fields. Failed to update invoice",
    };
  }

  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;

  try {
    await sql`
    UPDATE invoices
    SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
    WHERE id = ${id}
  `;
  } catch (error) {
    return {
      message: `Database Error: Failed to update invoice ${id}`,
    };
  }

  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

export async function deleteInvoice(id: string) {
  throw new Error("Failed to delete invoice");

  try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath("dashboard/invoices");
    return { message: `Deleted invoice` };
  } catch (error) {
    return {
      message: `Database Error: Failed to remove invoice ${id}`,
    };
  }
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData
) {
  try {
    await signIn("credentials", formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return "Invalid credentials.";
        default:
          return "Something went wrong.";
      }
    }
    throw error;
  }
}

// const CreateCustomer =

export async function createCustomer(
  prevState: CustomerState,
  formData: FormData
) {
  const validatedFields = CreateCustomer.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });

  console.log(validatedFields.data);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Failed to create customer",
    };
  }

  const { name, email } = validatedFields.data;

  try {
    await sql`INSERT INTO customers (name, email, image_url) VALUES (${name},${email}, 'https://static.vecteezy.com/system/resources/thumbnails/003/337/584/small/default-avatar-photo-placeholder-profile-icon-vector.jpg')`;
  } catch (error) {
    return {
      message: "Database Error: Failed to create invoice",
    };
  }

  revalidatePath("/dashboard/customers");
  redirect("/dashboard/customers");
}
